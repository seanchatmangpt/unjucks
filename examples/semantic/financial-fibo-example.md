# Financial API Generation from FIBO Ontology

This example demonstrates generating a PCI-DSS compliant financial API using the Financial Industry Business Ontology (FIBO).

## Prerequisites

```bash
# Install required ontology files
mkdir -p ./ontologies
curl -o ./ontologies/fibo-core.ttl "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/FinancialServicesEntities/"
curl -o ./ontologies/iso20022-messages.ttl "https://www.iso20022.org/sites/default/files/2023-03/iso20022_ontology.ttl"
```

## Basic Usage

```bash
# Generate a payment processing API
unjucks generate semantic/financial-api \
  --apiName "PaymentProcessing" \
  --withFinancial true \
  --withPayments true \
  --withAccountManagement true \
  --withTransactionHistory true \
  --to "./src/api/payment-processing.controller.ts"
```

## Advanced Usage with Multi-Ontology Support

```bash
# Generate with FIBO and ISO 20022 standards
unjucks generate semantic/financial-api \
  --apiName "CorporateBankingAPI" \
  --withFinancial true \
  --withPayments true \
  --withAccountManagement true \
  --ontologies.fibo.uri "https://spec.edmcouncil.org/fibo/ontology" \
  --ontologies.iso20022.uri "urn:iso:std:iso:20022" \
  --compliance.framework "PCI-DSS" \
  --compliance.version "4.0" \
  --semanticValidation true \
  --reasoning "owl"
```

## Generated API Features

The generated financial API includes:

### 1. FIBO-Based Financial Entities
- Account management (checking, savings, credit, investment)
- Financial instruments and securities
- Party and organization management
- Transaction and payment obligations

### 2. ISO 20022 Message Standards
- Customer Credit Transfer Initiation (pacs.008)
- Payment Status Report (pacs.002)
- Account Statement (camt.053)
- Balance Report (camt.052)

### 3. PCI-DSS Compliance
- Secure card data handling with tokenization
- Encrypted data transmission
- Access control and authentication
- Comprehensive security logging
- Vulnerability management

### 4. Example Generated Code

```typescript
/**
 * PaymentProcessing Financial API Controller
 * 
 * Generated from FIBO ontology with PCI-DSS compliance
 * Semantic validation: {"typeChecking": true, "domainRangeValidation": true}
 * 
 * @ontology FIBO (Financial Industry Business Ontology)
 * @compliance PCI-DSS 4.0
 * @generated 2024-01-15T10:30:00.000Z
 */

export class PaymentProcessingController {
  async processPayment = [
    // Input validation based on ISO 20022 schemas
    body('messageId').isString().isLength({ min: 1, max: 35 }),
    body('instructedAmount.currency').isISO4217(),
    body('instructedAmount.amount').isFloat({ gt: 0 }),
    body('creditorAccount.iban').optional().isIBAN(),
    
    async (req: Request, res: Response, next: NextFunction) => {
      const paymentInstruction: PaymentInstruction = {
        messageId: req.body.messageId,
        creationDateTime: new Date(),
        instructedAmount: req.body.instructedAmount,
        creditorAccount: req.body.creditorAccount,
        debtorAccount: req.body.debtorAccount
      };

      // Tokenize sensitive account data (PCI-DSS requirement)
      if (paymentInstruction.creditorAccount.iban) {
        paymentInstruction.creditorAccount.iban = await this.tokenization.tokenize(
          paymentInstruction.creditorAccount.iban,
          'IBAN'
        );
      }

      // Fraud detection based on FIBO risk models
      const fraudRisk = await this.fraudDetection.assessRisk({
        amount: paymentInstruction.instructedAmount.amount,
        currency: paymentInstruction.instructedAmount.currency,
        creditor: paymentInstruction.creditorAccount,
        debtor: paymentInstruction.debtorAccount
      });

      if (fraudRisk.riskLevel === 'HIGH') {
        return res.status(403).json({
          status: 'rejected',
          reasonCode: 'FRAUD_DETECTED'
        });
      }

      // Process payment according to ISO 20022 standards
      const result = await this.executePayment(paymentInstruction);
      
      res.status(200).json({
        status: 'accepted',
        messageId: paymentInstruction.messageId,
        transactionId: result.transactionId
      });
    }
  ];
}
```

## Ontology-Driven Features

### FIBO Semantic Validation
The generated API validates against FIBO constraints:
- Financial instrument type validation
- Party relationship constraints
- Account ownership validation
- Currency and amount constraints

### ISO 20022 Message Compliance
- Automatic message structure validation
- Standard business element validation
- Cross-reference validation
- Character set and length constraints

### PCI-DSS Security Controls
Compliance rules derived from security ontologies:
- Cardholder data protection
- Secure authentication methods
- Network security controls
- Regular security testing

## Template Variables from Ontology

The FIBO ontology provides these semantic variables:

```javascript
// Available in templates
$ontologies.fibo.classes = [
  { uri: 'https://spec.edmcouncil.org/fibo/ontology/FBC/FinancialInstruments/FinancialInstruments/FinancialInstrument' },
  { uri: 'https://spec.edmcouncil.org/fibo/ontology/FBC/ProductsAndServices/FinancialProductsAndServices/FinancialProduct' },
  { uri: 'https://spec.edmcouncil.org/fibo/ontology/FND/Parties/Parties/Party' }
];

$ontologies.iso20022.classes = [
  { uri: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08:CustomerCreditTransferInitiationV08' },
  { uri: 'urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10:FIToFIPaymentStatusReportV10' }
];

$compliance.validationResults = {
  "card_data_protection": true,
  "secure_transmission": true,
  "access_restrictions": true
};
```

## Custom Financial Products

Extend with custom financial product ontologies:

```yaml
---
ontologies:
  fibo:
    uri: "https://spec.edmcouncil.org/fibo/ontology"
    local: "./ontologies/fibo-core.ttl"
  customProducts:
    uri: "https://example.com/financial-products"
    local: "./ontologies/custom-derivatives.ttl"
semanticValidation: true
reasoning: "owl"
compliance:
  framework: "PCI-DSS"
  version: "4.0"
  rules:
    - "card_data_protection"
    - "secure_transmission"
    - "access_restrictions"
---

<!-- Template can now access custom derivative products -->
<% for (const product of $ontologies.customProducts.classes) { %>
interface <%= product.uri.split('/').pop() %> extends FinancialInstrument {
  // Automatically generated from ontology
}
<% } %>
```

## Performance Optimizations

The semantic renderer optimizes financial processing:

### Ontology Caching
- Caches FIBO class hierarchies
- Pre-computes common validation patterns
- Optimizes ISO 20022 schema lookups

### Security Processing
- Pre-validates PCI-DSS requirements
- Caches tokenization patterns
- Optimizes encryption key derivation

### Compliance Monitoring
- Real-time compliance status tracking
- Automated audit trail generation
- Performance metrics for regulatory reporting

## Real-World Integration

### Banking Core Systems
```typescript
// Generated service integrates with existing banking infrastructure
const bankingService = new PaymentProcessingController();

// Semantic validation ensures FIBO compliance
const validation = await bankingService.validateTransaction(payment);
if (!validation.fiboCompliant) {
  throw new Error('Transaction violates FIBO constraints');
}
```

### Regulatory Reporting
```typescript
// Automatic compliance reporting
const complianceReport = await bankingService.generateComplianceReport({
  framework: 'PCI-DSS',
  period: { start: '2024-01-01', end: '2024-01-31' },
  includeSemanticValidation: true
});
```

This example demonstrates how semantic templates transform financial domain knowledge into production-ready, compliant APIs with built-in validation and security controls.