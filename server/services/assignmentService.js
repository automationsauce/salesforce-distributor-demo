function getNextAgentForDistributor(account, distributor) {
  const activeAgents = (account.agents || [])
    .filter(agent =>
      agent.distributionId === distributor.id &&
      agent.active === true
    )
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));

  if (activeAgents.length === 0) {
    return {
      agent: null,
      nextAgentSequence: distributor.nextAgent || null
    };
  }

  const nextSequence = Number(distributor.nextAgent || activeAgents[0].sequence);

  let selectedIndex = activeAgents.findIndex(
    agent => Number(agent.sequence) === nextSequence
  );

  if (selectedIndex === -1) {
    selectedIndex = 0;
  }

  const selectedAgent = activeAgents[selectedIndex];

  const nextIndex =
    selectedIndex + 1 >= activeAgents.length
      ? 0
      : selectedIndex + 1;

  const nextAgentSequence = Number(activeAgents[nextIndex].sequence);

  distributor.nextAgent = nextAgentSequence;

  return {
    agent: selectedAgent,
    nextAgentSequence
  };
}

module.exports = {
  getNextAgentForDistributor
};