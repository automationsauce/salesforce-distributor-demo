function evaluateCriterion(record, criterion) {
  const recordValue = record[criterion.field];
  const targetValue = criterion.value;

  switch (criterion.operator) {
    case "=":
      return String(recordValue) === String(targetValue);
    case "!=":
      return String(recordValue) !== String(targetValue);
    case ">":
      return Number(recordValue) > Number(targetValue);
    case "<":
      return Number(recordValue) < Number(targetValue);
    case ">=":
      return Number(recordValue) >= Number(targetValue);
    case "<=":
      return Number(recordValue) <= Number(targetValue);
    default:
      return false;
  }
}

function evaluateLogic(logic, results) {
  let expression = logic || "";

  for (const sequence in results) {
    expression = expression.replaceAll(sequence, String(results[sequence]));
  }

  expression = expression
    .replaceAll("AND", "&&")
    .replaceAll("OR", "||");

  return Function(`return (${expression});`)();
}

module.exports = {
  evaluateCriterion,
  evaluateLogic,
};