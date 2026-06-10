export interface RequestType { label: string; className: string; sample: Record<string, unknown>; }
export interface ContractTemplate { id: string; name: string; description: string; category: string; namespace: string; model: string; logic: string; sampleParams: Record<string, unknown>; requestTypes: RequestType[]; }

const lateDeliveryLogic = `
function init({ contract }) {
  return { $class: "org.accordproject.latedelivery.LateDeliveryState", stateId: "state:1", status: "INITIALIZED", totalPenaltyAccrued: 0, deliveryCount: 0 };
}
function dispatch({ state, request, contract }) {
  if (request.$class !== "org.accordproject.latedelivery.LateDeliveryRequest") throw new Error("Unexpected request: " + request.$class);
  if (request.forceMajeure) return { state: { ...state, status: "ACTIVE", deliveryCount: state.deliveryCount + 1 }, response: { $class: "org.accordproject.latedelivery.LateDeliveryResponse", penalty: 0, buyerMayTerminate: false, daysLate: 0, message: "Force majeure — no penalty." }, emit: [] };
  const daysLate = Math.max(0, Math.ceil((new Date(request.deliveredAt || new Date()) - new Date(request.agreedDelivery)) / 86400000));
  if (daysLate === 0) return { state: { ...state, status: "ACTIVE", deliveryCount: state.deliveryCount + 1 }, response: { $class: "org.accordproject.latedelivery.LateDeliveryResponse", penalty: 0, buyerMayTerminate: false, daysLate: 0, message: "On time — no penalty." }, emit: [] };
  const penalty = Math.round(Math.min((contract.penaltyPercentage / 100) * request.goodsValue * daysLate, (contract.capPercentage / 100) * request.goodsValue) * 100) / 100;
  const buyerMayTerminate = daysLate >= contract.termination;
  const newState = { ...state, status: buyerMayTerminate ? "TERMINATED" : "ACTIVE", totalPenaltyAccrued: Math.round((state.totalPenaltyAccrued + penalty) * 100) / 100, deliveryCount: state.deliveryCount + 1 };
  return { state: newState, response: { $class: "org.accordproject.latedelivery.LateDeliveryResponse", penalty, buyerMayTerminate, daysLate, message: daysLate + " day(s) late. Penalty: $" + penalty + (buyerMayTerminate ? " — buyer may terminate." : ".") }, emit: buyerMayTerminate ? [{ $class: "org.accordproject.latedelivery.TerminationEvent", reason: daysLate + " days late." }] : [] };
}
`;

const installmentLogic = `
function init({ contract }) {
  return { $class: "org.accordproject.installmentsale.State", stateId: "state:1", status: "ACTIVE", balance: contract.totalAmount, totalPaid: 0, totalInterest: 0, paymentCount: 0 };
}
function dispatch({ state, request, contract }) {
  if (request.$class === "org.accordproject.installmentsale.BalanceRequest") return { state, response: { $class: "org.accordproject.installmentsale.BalanceResponse", balance: state.balance, totalPaid: state.totalPaid, totalInterest: state.totalInterest, paymentCount: state.paymentCount, status: state.status }, emit: [] };
  if (request.$class === "org.accordproject.installmentsale.PaymentRequest") {
    if (state.status !== "ACTIVE") throw new Error("Contract is " + state.status);
    if (request.amount <= 0) throw new Error("Payment must be positive.");
    if (request.amount < contract.minimumPayment && state.balance > contract.minimumPayment) throw new Error("Below minimum payment of $" + contract.minimumPayment);
    const interest = Math.round(state.balance * (contract.interestRate / 100 / 12) * 100) / 100;
    const principal = Math.max(0, request.amount - interest);
    const newBalance = Math.round(Math.max(0, state.balance - principal) * 100) / 100;
    const newStatus = newBalance === 0 ? "PAID_OFF" : "ACTIVE";
    const newState = { ...state, balance: newBalance, totalPaid: Math.round((state.totalPaid + request.amount) * 100) / 100, totalInterest: Math.round((state.totalInterest + interest) * 100) / 100, paymentCount: state.paymentCount + 1, status: newStatus };
    return { state: newState, response: { $class: "org.accordproject.installmentsale.PaymentResponse", amountApplied: request.amount, interestCharged: interest, remainingBalance: newBalance, status: newStatus, message: newStatus === "PAID_OFF" ? "Paid off! Total: $" + newState.totalPaid : "$" + request.amount + " received. Balance: $" + newBalance }, emit: newStatus === "PAID_OFF" ? [{ $class: "org.accordproject.installmentsale.PaidOffEvent", totalPaid: newState.totalPaid }] : [] };
  }
  throw new Error("Unknown request: " + request.$class);
}
`;

const safetyLogic = `
function init({ contract }) {
  return { $class: "org.accordproject.safety.State", stateId: "state:1", status: "COMPLIANT", violationCount: 0, totalFinesIssued: 0, inspectionCount: 0 };
}
function dispatch({ state, request, contract }) {
  if (request.$class === "org.accordproject.safety.InspectionRequest") {
    if (state.status === "TERMINATED") throw new Error("Contract terminated.");
    const inspCount = state.inspectionCount + 1;
    if (request.passedInspection) return { state: { ...state, status: "COMPLIANT", inspectionCount: inspCount }, response: { $class: "org.accordproject.safety.InspectionResponse", status: "COMPLIANT", fine: 0, violationCount: state.violationCount, message: "Inspection #" + inspCount + " passed." }, emit: [] };
    const violations = state.violationCount + 1;
    const fine = Math.round(contract.finePerViolation * violations * 100) / 100;
    const escalate = violations >= contract.maxViolations;
    const newState = { ...state, status: escalate ? "TERMINATED" : "NON_COMPLIANT", violationCount: violations, totalFinesIssued: Math.round((state.totalFinesIssued + fine) * 100) / 100, inspectionCount: inspCount };
    return { state: newState, response: { $class: "org.accordproject.safety.InspectionResponse", status: newState.status, fine, violationCount: violations, message: (escalate ? "Contract terminated. " : "Violation #" + violations + ". ") + "Fine: $" + fine }, emit: [escalate ? { $class: "org.accordproject.safety.EscalationEvent", totalFines: newState.totalFinesIssued } : { $class: "org.accordproject.safety.ViolationEvent", violationNumber: violations, fine }] };
  }
  if (request.$class === "org.accordproject.safety.RemediationRequest") {
    if (state.status === "COMPLIANT") return { state, response: { $class: "org.accordproject.safety.RemediationResponse", status: "COMPLIANT", message: "Already compliant." }, emit: [] };
    const newStatus = request.fullyRemediated ? "COMPLIANT" : "NON_COMPLIANT";
    return { state: { ...state, status: newStatus }, response: { $class: "org.accordproject.safety.RemediationResponse", status: newStatus, message: request.fullyRemediated ? "Compliance restored." : "Partial remediation noted." }, emit: request.fullyRemediated ? [{ $class: "org.accordproject.safety.ComplianceRestoredEvent" }] : [] };
  }
  throw new Error("Unknown request: " + request.$class);
}
`;

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'late-delivery', name: 'Late Delivery and Penalty', description: 'Calculates daily penalties when goods are delivered late, with a cap and termination right.', category: 'Supply Chain', namespace: 'org.accordproject.latedelivery',
    model: `namespace org.accordproject.latedelivery\n\nasset LateDeliveryContract extends AccordContract {\n  o Double penaltyPercentage\n  o Double capPercentage\n  o Integer termination\n}\n\ntransaction LateDeliveryRequest extends Request {\n  o Boolean forceMajeure\n  o DateTime agreedDelivery\n  o DateTime deliveredAt optional\n  o Double goodsValue\n}\n\ntransaction LateDeliveryResponse extends Response {\n  o Double penalty\n  o Boolean buyerMayTerminate\n  o Integer daysLate\n  o String message\n}`,
    logic: lateDeliveryLogic,
    sampleParams: { $class: 'org.accordproject.latedelivery.LateDeliveryContract', penaltyPercentage: 2, capPercentage: 10, termination: 15 },
    requestTypes: [
      { label: 'On-time Delivery', className: 'org.accordproject.latedelivery.LateDeliveryRequest', sample: { $class: 'org.accordproject.latedelivery.LateDeliveryRequest', forceMajeure: false, agreedDelivery: new Date(Date.now() - 86400000).toISOString(), deliveredAt: new Date().toISOString(), goodsValue: 10000 } },
      { label: 'Late (5 days)', className: 'org.accordproject.latedelivery.LateDeliveryRequest', sample: { $class: 'org.accordproject.latedelivery.LateDeliveryRequest', forceMajeure: false, agreedDelivery: new Date(Date.now() - 6 * 86400000).toISOString(), deliveredAt: new Date().toISOString(), goodsValue: 10000 } },
      { label: 'Force Majeure', className: 'org.accordproject.latedelivery.LateDeliveryRequest', sample: { $class: 'org.accordproject.latedelivery.LateDeliveryRequest', forceMajeure: true, agreedDelivery: new Date(Date.now() - 10 * 86400000).toISOString(), deliveredAt: new Date().toISOString(), goodsValue: 10000 } },
      { label: 'Termination (20 days)', className: 'org.accordproject.latedelivery.LateDeliveryRequest', sample: { $class: 'org.accordproject.latedelivery.LateDeliveryRequest', forceMajeure: false, agreedDelivery: new Date(Date.now() - 21 * 86400000).toISOString(), deliveredAt: new Date().toISOString(), goodsValue: 10000 } },
    ],
  },
  {
    id: 'installment-sale', name: 'Installment Sale', description: 'Tracks loan balance through installment payments with monthly interest.', category: 'Finance', namespace: 'org.accordproject.installmentsale',
    model: `namespace org.accordproject.installmentsale\n\nasset InstallmentSaleContract extends AccordContract {\n  o Double totalAmount\n  o Double minimumPayment\n  o Double interestRate\n}\n\ntransaction PaymentRequest extends Request { o Double amount }\ntransaction BalanceRequest extends Request { }`,
    logic: installmentLogic,
    sampleParams: { $class: 'org.accordproject.installmentsale.InstallmentSaleContract', totalAmount: 5000, minimumPayment: 200, interestRate: 6 },
    requestTypes: [
      { label: 'Make Payment', className: 'org.accordproject.installmentsale.PaymentRequest', sample: { $class: 'org.accordproject.installmentsale.PaymentRequest', amount: 500 } },
      { label: 'Check Balance', className: 'org.accordproject.installmentsale.BalanceRequest', sample: { $class: 'org.accordproject.installmentsale.BalanceRequest' } },
      { label: 'Large Payment', className: 'org.accordproject.installmentsale.PaymentRequest', sample: { $class: 'org.accordproject.installmentsale.PaymentRequest', amount: 5000 } },
    ],
  },
  {
    id: 'safety-obligation', name: 'Safety Obligation', description: 'Enforces safety compliance via inspections, issues fines, and terminates on repeated violations.', category: 'Compliance', namespace: 'org.accordproject.safety',
    model: `namespace org.accordproject.safety\n\nasset SafetyContract extends AccordContract {\n  o Double finePerViolation\n  o Integer maxViolations\n}\n\ntransaction InspectionRequest extends Request {\n  o Boolean passedInspection\n  o String inspectorName\n}\ntransaction RemediationRequest extends Request {\n  o String remediation\n  o Boolean fullyRemediated\n}`,
    logic: safetyLogic,
    sampleParams: { $class: 'org.accordproject.safety.SafetyContract', finePerViolation: 500, maxViolations: 3 },
    requestTypes: [
      { label: 'Inspection – Pass', className: 'org.accordproject.safety.InspectionRequest', sample: { $class: 'org.accordproject.safety.InspectionRequest', passedInspection: true, inspectorName: 'J. Smith' } },
      { label: 'Inspection – Fail', className: 'org.accordproject.safety.InspectionRequest', sample: { $class: 'org.accordproject.safety.InspectionRequest', passedInspection: false, inspectorName: 'J. Smith' } },
      { label: 'Full Remediation', className: 'org.accordproject.safety.RemediationRequest', sample: { $class: 'org.accordproject.safety.RemediationRequest', remediation: 'Systems repaired.', fullyRemediated: true } },
    ],
  },
];

export function getTemplateById(id: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find((t) => t.id === id);
}
