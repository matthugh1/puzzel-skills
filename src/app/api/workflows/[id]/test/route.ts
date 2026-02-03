import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';
import { canViewWorkflow } from '@/lib/workflow-permissions';
import { saveFile, FILE_REF_PREFIX, initializeFileStorage } from '@/lib/file-storage';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/workflows/:id/test
 * Test run a workflow (creates AgentRun and triggers execution)
 * Similar to /run but allows testing draft workflows
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // Log immediately to verify this endpoint is being called
  console.error('===== TEST ENDPOINT CALLED =====');
  console.log('===== TEST ENDPOINT CALLED =====');
  
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    console.error('TEST ENDPOINT: CSRF error');
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check permissions (test allows draft workflows)
    const canView = await canViewWorkflow(user.id, workflow.id);
    if (!canView) {
      return NextResponse.json(
        { error: 'Workflow not accessible' },
        { status: 403 }
      );
    }

    // Initialize file storage
    await initializeFileStorage();

    // Handle multipart/form-data (for file uploads) or JSON
    let body: {
      initialContext?: Record<string, unknown>;
      policyId?: string;
      inputAllowlist?: string[] | null;
      idempotencyKey?: string;
      plan?: unknown;
    };
    let uploadedFiles: Map<string, { file: File; fieldName: string }> = new Map();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      // Parse FormData
      const formData = await request.formData();
      
      // Extract JSON data from 'data' field
      const dataField = formData.get('data');
      if (typeof dataField === 'string') {
        try {
          body = JSON.parse(dataField);
        } catch (e) {
          return NextResponse.json(
            { error: 'Invalid JSON in data field' },
            { status: 400 }
          );
        }
      } else {
        body = {};
      }

      // Extract files (all fields that are File objects)
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && key !== 'data') {
          uploadedFiles.set(key, { file: value, fieldName: key });
        }
      }
    } else {
      // Standard JSON request
      body = await validateRequestBody(request, validationSchemas.runWorkflow);
    }

    const { initialContext = {}, policyId, inputAllowlist, idempotencyKey, plan: planOverride, llmProvider: testLlmProvider, llmModel: testLlmModel } = body;

    // Load policy if provided
    let policy = null;
    if (policyId) {
      policy = await db.runPolicy.findUnique({
        where: { id: policyId },
      });
      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }
    }

    // Validate initialContext size
    // For test runs, use a more generous limit (5MB) since test runs are for development/testing
    // Production runs will still respect the policy limit
    const initialContextSize = JSON.stringify(initialContext).length;
    const maxSize = policy?.maxInitialContextBytes ?? 5 * 1024 * 1024; // 5MB default for test runs
    if (initialContextSize > maxSize) {
      return NextResponse.json(
        { error: `Initial context size (${initialContextSize} bytes) exceeds limit (${maxSize} bytes). For test runs, the limit is 5MB.` },
        { status: 400 }
      );
    }

    // Use plan override if provided (for testing unsaved changes), otherwise use workflow's plan
    const planToUse = planOverride || workflow.plan;

    // Validate plan structure
    if (!planToUse || typeof planToUse !== 'object') {
      return NextResponse.json(
        { error: 'Workflow plan is invalid or missing' },
        { status: 400 }
      );
    }

    const planObj = planToUse as { steps?: unknown[] };
    if (!planObj.steps || !Array.isArray(planObj.steps) || planObj.steps.length === 0) {
      return NextResponse.json(
        { error: 'Workflow plan must have at least one step' },
        { status: 400 }
      );
    }

    // Ensure steps have IDs and sequential connections (required by LangGraph)
    // First pass: generate IDs for all steps
    const stepsWithIds = planObj.steps.map((step: unknown, index: number) => {
      const stepObj = step as { 
        id?: string; 
        type?: string; 
        config?: Record<string, unknown>;
        next?: string[];
      };
      
      // Generate ID if missing
      const stepId = stepObj.id || `step-${index}-${Date.now()}`;
      
      return {
        ...stepObj,
        id: stepId,
      };
    });

    // Second pass: add sequential connections
    const finalSteps = stepsWithIds.map((step, index) => {
      // If step already has next connections, keep them
      if (step.next && step.next.length > 0) {
        return step;
      }
      
      // Otherwise, connect sequentially to next step (if not last)
      if (index < stepsWithIds.length - 1) {
        return {
          ...step,
          next: [stepsWithIds[index + 1].id],
        };
      }
      
      // Last step has no next (will connect to END in graph builder)
      return {
        ...step,
        next: [],
      };
    });

    const validatedPlan = {
      ...planObj,
      steps: finalSteps,
    };

    // Prepare initial context (will be updated with file references after run creation)
    let serializableInitialContext: Record<string, unknown> = { ...initialContext };

    // Create AgentRun first (we need runId to save files)
    let run;
    try {
      console.error('[TEST] Attempting to create AgentRun with initialContext size:', JSON.stringify(serializableInitialContext).length);
      console.error('[TEST] InitialContext keys:', Object.keys(serializableInitialContext));
      
      run = await db.agentRun.create({
        data: {
          workflowId: workflow.id,
          userId: user.id,
          goal: `[TEST] ${workflow.name}`, // Mark as test run
          initialContext: serializableInitialContext,
          policyId: policy?.id ?? null,
          inputAllowlist: inputAllowlist || null,
          status: 'RUNNING', // Skip planning - use workflow's plan
          plan: validatedPlan, // Use validated plan with IDs
          idempotencyKey: idempotencyKey || null,
          startedAt: new Date(),
          metadata: {
            isTestRun: true, // Mark as test run in metadata
            ...(testLlmProvider && { testLlmProvider }),
            ...(testLlmModel && { testLlmModel }),
          } as Record<string, unknown>,
        },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      console.error('[TEST] AgentRun created successfully:', run.id);
    } catch (createError) {
      console.error('[TEST] Error creating AgentRun:', createError);
      console.error('[TEST] Create error details:', {
        message: createError instanceof Error ? createError.message : String(createError),
        name: createError instanceof Error ? createError.name : 'Unknown',
        stack: createError instanceof Error ? createError.stack : 'No stack',
      });
      
      // Check if it's a Prisma error
      if (createError && typeof createError === 'object') {
        const prismaError = createError as { code?: string; meta?: unknown; clientVersion?: string };
        console.error('[TEST] Prisma error code:', prismaError.code);
        console.error('[TEST] Prisma error meta:', JSON.stringify(prismaError.meta, null, 2));
        console.error('[TEST] Prisma client version:', prismaError.clientVersion);
      }
      
      throw createError; // Re-throw to be caught by outer catch
    }

    // Save uploaded files and update initialContext with file references
    if (uploadedFiles.size > 0) {
      try {
        const fileReferences: Record<string, string> = {};
        
        for (const [fieldName, { file }] of uploadedFiles.entries()) {
          // Read file as buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Save file and get reference
          const fileRef = await saveFile(run.id, fieldName, buffer, file.name);
          fileReferences[fieldName] = fileRef;
          
          console.log(`[TEST] Saved file for field ${fieldName}: ${fileRef}`);
        }

        // Update initialContext with file references
        serializableInitialContext = {
          ...serializableInitialContext,
          ...fileReferences,
        };

        // Update run with file references in initialContext
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            initialContext: serializableInitialContext,
          },
        });

        console.log(`[TEST] Updated run ${run.id} with ${uploadedFiles.size} file references`);
      } catch (fileError) {
        console.error('[TEST] Error saving files:', fileError);
        // Don't fail the request - files are optional, but log the error
        // The run will continue with text-only initialContext
      }
    }

    // Log audit event
    await audit.agentRunCreated(run.id, user.id, {
      goal: run.goal,
      workflowId: workflow.id,
      policyId: run.policyId,
      isTestRun: true,
    }, request);

    // Trigger LangGraph execution (async, don't wait)
    // Log immediately to verify this code path is executed
    const testLogPrefix = `[TEST-${run.id.substring(0, 8)}]`;
    console.error(`${testLogPrefix} ====== TEST ENDPOINT: Triggering workflow execution ======`);
    console.error(`${testLogPrefix} Run ID: ${run.id}`);
    console.error(`${testLogPrefix} Run Status: ${run.status}`);
    console.error(`${testLogPrefix} executeWorkflow function type: ${typeof executeWorkflow}`);
    
    // Verify the function exists and is callable
    if (typeof executeWorkflow !== 'function') {
      const error = new Error('executeWorkflow is not a function');
      console.error(`${testLogPrefix} CRITICAL ERROR:`, error);
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          metadata: {
            error: 'executeWorkflow is not a function',
            failedAt: new Date().toISOString(),
          } as Record<string, unknown>,
        },
      });
      return NextResponse.json(
        { error: 'Internal error: executor not available' },
        { status: 500 }
      );
    }
    
    // Use setImmediate to ensure this runs after the response is sent
    // This prevents Next.js from potentially cancelling the async operation
    setImmediate(async () => {
      console.error(`${testLogPrefix} setImmediate callback executing`);
      
      try {
        console.error(`${testLogPrefix} About to call executeWorkflow`);
        const executionPromise = executeWorkflow(run.id);
        console.error(`${testLogPrefix} executeWorkflow promise created, type: ${typeof executionPromise}`);
        
        if (!(executionPromise instanceof Promise)) {
          console.error(`${testLogPrefix} ERROR: executeWorkflow did not return a Promise!`);
          await db.agentRun.update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              metadata: {
                error: 'executeWorkflow did not return a Promise',
                failedAt: new Date().toISOString(),
              } as Record<string, unknown>,
            },
          });
          return;
        }
        
        executionPromise
          .then(() => {
            console.error(`${testLogPrefix} Workflow execution completed successfully`);
          })
          .catch((error) => {
            console.error(`${testLogPrefix} ====== Workflow execution ERROR ======`);
            console.error(`${testLogPrefix} Error:`, error);
            console.error(`${testLogPrefix} Error message:`, error instanceof Error ? error.message : String(error));
            console.error(`${testLogPrefix} Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
            
            // The executor should have already updated the run status, but ensure it's updated
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            db.agentRun.update({
              where: { id: run.id },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                metadata: {
                  error: errorMessage,
                  errorStack,
                  failedAt: new Date().toISOString(),
                  executionError: true,
                } as Record<string, unknown>,
              },
            }).catch((updateError) => {
              console.error(`${testLogPrefix} Failed to update run status after error:`, updateError);
            });
          });
      } catch (syncError) {
        // Catch any synchronous errors
        console.error(`${testLogPrefix} ====== SYNCHRONOUS ERROR ======`);
        console.error(`${testLogPrefix} Sync error:`, syncError);
        console.error(`${testLogPrefix} Sync error message:`, syncError instanceof Error ? syncError.message : String(syncError));
        console.error(`${testLogPrefix} Sync error stack:`, syncError instanceof Error ? syncError.stack : 'No stack');
        
        try {
          await db.agentRun.update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              metadata: {
                error: syncError instanceof Error ? syncError.message : String(syncError),
                errorStack: syncError instanceof Error ? syncError.stack : undefined,
                failedAt: new Date().toISOString(),
                executionError: true,
                synchronousError: true,
              } as Record<string, unknown>,
            },
          });
        } catch (updateError) {
          console.error(`${testLogPrefix} Failed to update run status in sync error handler:`, updateError);
        }
      }
    });

    // Return immediately with run ID for streaming
    const response = NextResponse.json(
      { run: { id: run.id, status: run.status } },
      { status: 202 }
    );
    
    // Add debug header to verify endpoint was called
    response.headers.set('X-Test-Endpoint-Called', 'true');
    response.headers.set('X-Run-Id', run.id);
    console.error(`[TEST] Returning response for run ${run.id}`);
    
    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Test workflow error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? error.cause : undefined,
    });
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as { code?: string }).code);
      console.error('Prisma error meta:', (error as { meta?: unknown }).meta);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack 
      ? `${errorMessage}\n\nStack:\n${error.stack.substring(0, 500)}`
      : errorMessage;
    
    return NextResponse.json(
      { error: 'Failed to test workflow', details: errorDetails },
      { status: 500 }
    );
  }
}
