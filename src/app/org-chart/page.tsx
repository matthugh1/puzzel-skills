'use client';

import { useEffect, useMemo, useState } from 'react';
import { agentsApi, orgChartsApi } from '@/lib/api-client';

interface OrgChart {
  id: string;
  name: string;
  visibility: 'TEAM' | 'ORG';
  isDefault: boolean;
}

interface OrgNodeAgent {
  id: string;
  name: string;
  status: 'READY' | 'RUNNING' | 'DISABLED';
  ownerId: string;
}

interface OrgNode {
  id: string;
  chartId: string;
  type: 'DEPARTMENT' | 'TEAM' | 'AGENT';
  name: string;
  parentId: string | null;
  agentId: string | null;
  roleTitle: string | null;
  departmentLabel: string | null;
  order: number;
  agent?: OrgNodeAgent | null;
}

interface Agent {
  id: string;
  name: string;
  status: 'READY' | 'RUNNING' | 'DISABLED';
}

export default function OrgChartPage() {
  const [charts, setCharts] = useState<OrgChart[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newChartName, setNewChartName] = useState('');
  const [newChartDefault, setNewChartDefault] = useState(true);

  const [departmentName, setDepartmentName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDepartmentId, setTeamDepartmentId] = useState('');

  const [agentNodeName, setAgentNodeName] = useState('');
  const [agentTeamId, setAgentTeamId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentRoleTitle, setAgentRoleTitle] = useState('');

  const [departmentFilter, setDepartmentFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (selectedChartId) {
      void loadNodes(selectedChartId);
    }
  }, [selectedChartId]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      setError(null);
      const [chartsResponse, agentsResponse] = await Promise.all([
        orgChartsApi.list(),
        agentsApi.list(),
      ]);
      const loadedCharts = chartsResponse.charts as OrgChart[];
      setCharts(loadedCharts);

      const defaultChart = loadedCharts.find((chart) => chart.isDefault) ?? loadedCharts[0] ?? null;
      setSelectedChartId(defaultChart?.id ?? null);

      setAgents(agentsResponse.agents as Agent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load org chart data');
    } finally {
      setLoading(false);
    }
  };

  const loadNodes = async (chartId: string) => {
    try {
      setActionError(null);
      const response = await orgChartsApi.getNodes(chartId);
      setNodes(response.nodes as OrgNode[]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load org chart nodes');
    }
  };

  const handleCreateChart = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newChartName.trim()) return;

    try {
      setActionError(null);
      const response = await orgChartsApi.create({
        name: newChartName.trim(),
        visibility: 'ORG',
        isDefault: newChartDefault,
      });
      const created = response.chart as OrgChart;
      const updatedCharts = newChartDefault
        ? [created, ...charts.map((chart) => ({ ...chart, isDefault: false }))]
        : [created, ...charts];
      setCharts(updatedCharts);
      setSelectedChartId(created.id);
      setNewChartName('');
      setNewChartDefault(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create org chart');
    }
  };

  const handleCreateDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChartId || !departmentName.trim()) return;

    try {
      setActionError(null);
      await orgChartsApi.createNode(selectedChartId, {
        type: 'DEPARTMENT',
        name: departmentName.trim(),
      });
      setDepartmentName('');
      await loadNodes(selectedChartId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create department');
    }
  };

  const handleCreateTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChartId || !teamName.trim() || !teamDepartmentId) return;

    try {
      setActionError(null);
      await orgChartsApi.createNode(selectedChartId, {
        type: 'TEAM',
        name: teamName.trim(),
        parentId: teamDepartmentId,
      });
      setTeamName('');
      setTeamDepartmentId('');
      await loadNodes(selectedChartId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  const handleCreateAgentNode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChartId || !agentId || !agentTeamId) return;

    try {
      setActionError(null);
      const selectedAgent = agents.find((agent) => agent.id === agentId);
      await orgChartsApi.createNode(selectedChartId, {
        type: 'AGENT',
        name: agentNodeName.trim() || selectedAgent?.name || 'Agent',
        parentId: agentTeamId,
        agentId,
        roleTitle: agentRoleTitle.trim() || undefined,
      });
      setAgentNodeName('');
      setAgentTeamId('');
      setAgentId('');
      setAgentRoleTitle('');
      await loadNodes(selectedChartId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add agent');
    }
  };

  const handleMoveAgent = async (nodeId: string, newTeamId: string) => {
    if (!selectedChartId) return;

    try {
      setActionError(null);
      await orgChartsApi.updateNode(selectedChartId, nodeId, {
        parentId: newTeamId,
      });
      await loadNodes(selectedChartId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to move agent');
    }
  };

  const handleUpdateRoleTitle = async (nodeId: string, value: string) => {
    if (!selectedChartId) return;

    try {
      setActionError(null);
      await orgChartsApi.updateNode(selectedChartId, nodeId, {
        roleTitle: value.trim() || undefined,
      });
      await loadNodes(selectedChartId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const departments = useMemo(
    () => nodes.filter((node) => node.type === 'DEPARTMENT'),
    [nodes]
  );
  const teams = useMemo(
    () => nodes.filter((node) => node.type === 'TEAM'),
    [nodes]
  );
  const agentNodes = useMemo(
    () => nodes.filter((node) => node.type === 'AGENT'),
    [nodes]
  );

  const unassignedAgents = useMemo(() => {
    const assigned = new Set(agentNodes.map((node) => node.agentId).filter(Boolean));
    return agents.filter((agent) => !assigned.has(agent.id));
  }, [agentNodes, agents]);

  const filteredDepartments = useMemo(() => {
    if (!departmentFilter) return departments;
    return departments.filter((department) => department.id === departmentFilter);
  }, [departments, departmentFilter]);

  const teamsByDepartment = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    for (const team of teams) {
      if (!team.parentId) continue;
      const list = map.get(team.parentId) ?? [];
      list.push(team);
      map.set(team.parentId, list);
    }
    return map;
  }, [teams]);

  const agentsByTeam = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    for (const agentNode of agentNodes) {
      if (!agentNode.parentId) continue;
      const list = map.get(agentNode.parentId) ?? [];
      list.push(agentNode);
      map.set(agentNode.parentId, list);
    }
    return map;
  }, [agentNodes]);

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Org Chart
          </h1>
        </header>
        <main className="page-content">
          <div style={{ color: 'var(--color-text-secondary)' }}>Loading org chart...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--spacing-lg)',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                margin: 0,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Org Chart
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-secondary)' }}>
              Visualize departments, teams, and agent roles.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            {charts.length > 0 && (
              <select
                value={selectedChartId ?? ''}
                onChange={(event) => setSelectedChartId(event.target.value)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {charts.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.name}{chart.isDefault ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="page-content">
        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {actionError && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-warning-bg)',
              color: 'var(--color-warning-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            {actionError}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: 'var(--spacing-xl)',
          }}
        >
          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Chart Controls</h2>
              <form onSubmit={handleCreateChart} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>New chart name</label>
                <input
                  className="input"
                  value={newChartName}
                  onChange={(event) => setNewChartName(event.target.value)}
                  placeholder="AI Org Chart"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newChartDefault}
                    onChange={(event) => setNewChartDefault(event.target.checked)}
                  />
                  Set as default chart
                </label>
                <button
                  type="submit"
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Create chart
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Add Department</h2>
              <form onSubmit={handleCreateDepartment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <input
                  className="input"
                  value={departmentName}
                  onChange={(event) => setDepartmentName(event.target.value)}
                  placeholder="Product"
                />
                <button
                  type="submit"
                  disabled={!selectedChartId}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    opacity: selectedChartId ? 1 : 0.6,
                  }}
                >
                  Add department
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Add Team</h2>
              <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <input
                  className="input"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Growth"
                />
                <select
                  value={teamDepartmentId}
                  onChange={(event) => setTeamDepartmentId(event.target.value)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedChartId}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    opacity: selectedChartId ? 1 : 0.6,
                  }}
                >
                  Add team
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Add Agent</h2>
              <form onSubmit={handleCreateAgentNode} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <input
                  className="input"
                  value={agentNodeName}
                  onChange={(event) => setAgentNodeName(event.target.value)}
                  placeholder="Display name (optional)"
                />
                <select
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <option value="">Select agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.status})
                    </option>
                  ))}
                </select>
                <select
                  value={agentTeamId}
                  onChange={(event) => setAgentTeamId(event.target.value)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  value={agentRoleTitle}
                  onChange={(event) => setAgentRoleTitle(event.target.value)}
                  placeholder="Role title (optional)"
                />
                <button
                  type="submit"
                  disabled={!selectedChartId}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    opacity: selectedChartId ? 1 : 0.6,
                  }}
                >
                  Add agent
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Filters</h2>
              <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Department</label>
              <select
                value={departmentFilter}
                onChange={(event) => {
                  setDepartmentFilter(event.target.value);
                  setTeamFilter('');
                }}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Team</label>
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <option value="">All teams</option>
                {teams
                  .filter((team) => (!departmentFilter ? true : team.parentId === departmentFilter))
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {charts.length === 0 && (
              <div className="card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                  Create your first org chart to start mapping departments, teams, and agents.
                </p>
              </div>
            )}

            {charts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                {filteredDepartments.map((department) => {
                  const departmentTeams = teamsByDepartment.get(department.id) ?? [];
                  if (departmentFilter && department.id !== departmentFilter) return null;

                  return (
                    <div key={department.id} className="card" style={{ padding: 'var(--spacing-lg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>{department.name}</h2>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Department</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                        {departmentTeams
                          .filter((team) => (!teamFilter ? true : team.id === teamFilter))
                          .map((team) => {
                            const teamAgents = agentsByTeam.get(team.id) ?? [];
                            return (
                              <div key={team.id} className="card" style={{ padding: 'var(--spacing-md)', border: '1px solid var(--color-border-muted)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h3 style={{ margin: 0 }}>{team.name}</h3>
                                  <span style={{ color: 'var(--color-text-secondary)' }}>Team</span>
                                </div>

                                {teamAgents.length === 0 && (
                                  <div style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                                    No agents assigned yet.
                                  </div>
                                )}

                                {teamAgents.length > 0 && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                    {teamAgents.map((agentNode) => (
                                      <div key={agentNode.id} className="card" style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--color-border-muted)' }}>
                                        <div style={{ fontWeight: 600 }}>{agentNode.name}</div>
                                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                          {agentNode.roleTitle || 'Role title not set'}
                                        </div>
                                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                          Status: {agentNode.agent?.status ?? 'Unknown'}
                                        </div>
                                        <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Move to team</label>
                                          <select
                                            value={agentNode.parentId ?? ''}
                                            onChange={(event) => handleMoveAgent(agentNode.id, event.target.value)}
                                            style={{
                                              width: '100%',
                                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                                              borderRadius: 'var(--radius-md)',
                                              border: '1px solid var(--color-border)',
                                              background: 'var(--color-surface)',
                                              color: 'var(--color-text)',
                                              fontFamily: 'var(--font-body)',
                                            }}
                                          >
                                            {teams.map((option) => (
                                              <option key={option.id} value={option.id}>
                                                {option.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Role title</label>
                                          <input
                                            className="input"
                                            defaultValue={agentNode.roleTitle ?? ''}
                                            onBlur={(event) => handleUpdateRoleTitle(agentNode.id, event.target.value)}
                                            placeholder="Role title"
                                            style={{ fontSize: '0.875rem', padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}

                <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
                  <h2 style={{ margin: '0 0 var(--spacing-md) 0' }}>Unassigned Agents</h2>
                  {unassignedAgents.length === 0 && (
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                      All agents are assigned to teams.
                    </p>
                  )}
                  {unassignedAgents.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                      {unassignedAgents.map((agent) => (
                        <li key={agent.id} className="card" style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--color-border-muted)' }}>
                          <div style={{ fontWeight: 600 }}>{agent.name}</div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            Status: {agent.status}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
