/**
 * @fileoverview Payment system for marketplace transactions
 * @version 1.0.0
 * @description Multi-currency payment processing with policy enforcement
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Currency, PricingModel, ValueVector } from '../types/kpack.js';

// ==============================================================================
// Payment Types and Interfaces
// ==============================================================================

/**
 * Payment transaction status
 */
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'expired';

/**
 * Payment method types
 */
export type PaymentMethodType = 
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'crypto_wallet'
  | 'platform_credits'
  | 'invoice'
  | 'subscription';

/**
 * Payment method information
 */
export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  provider: string;
  currency: Currency;
  metadata: {
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    brand?: string;
    walletAddress?: string;
    bankName?: string;
    accountType?: string;
  };
  verified: boolean;
  default: boolean;
  createdAt: Date;
}

/**
 * Payment intent for processing
 */
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: Currency;
  description: string;
  metadata: {
    kpackId: string;
    kpackVersion: string;
    listingId: string;
    purchaserId: string;
    publisherId: string;
    licenseTerms?: string;
  };
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  confirmationCode?: string;
  receiptUrl?: string;
  refundPolicy?: string;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string;
  paymentIntentId: string;
  type: 'payment' | 'refund' | 'chargeback' | 'adjustment';
  amount: number;
  currency: Currency;
  fee: number;
  netAmount: number;
  status: PaymentStatus;
  gateway: string;
  gatewayTransactionId: string;
  processedAt: Date;
  settledAt?: Date;
  failureReason?: string;
  riskScore?: number;
  fraudFlags?: string[];
}

/**
 * Payment receipt with attestation
 */
export interface PaymentReceipt {
  id: string;
  transactionId: string;
  purchaser: {
    id: string;
    name: string;
    email: string;
  };
  publisher: {
    id: string;
    name: string;
    email: string;
  };
  item: {
    kpackId: string;
    kpackName: string;
    version: string;
    listingId: string;
  };
  payment: {
    amount: number;
    currency: Currency;
    method: PaymentMethodType;
    processedAt: Date;
  };
  license: {
    type: string;
    terms: string;
    validFrom: Date;
    validUntil?: Date;
    restrictions?: string[];
  };
  cryptographicProof: {
    signature: string;
    algorithm: string;
    publicKey: string;
    timestamp: string;
    nonce: string;
  };
  downloadToken: string;
  receiptUrl: string;
  supportContact: string;
}

/**
 * Currency exchange rate
 */
export interface ExchangeRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  timestamp: Date;
  source: string;
  validUntil: Date;
}

/**
 * Payment policy configuration
 */
export interface PaymentPolicy {
  id: string;
  name: string;
  description: string;
  rules: {
    minimumAmount?: number;
    maximumAmount?: number;
    allowedCurrencies: Currency[];
    allowedPaymentMethods: PaymentMethodType[];
    requireVerification: boolean;
    fraudChecks: {
      enabled: boolean;
      riskThreshold: number;
      blacklistedCountries?: string[];
      velocityLimits?: {
        daily: number;
        weekly: number;
        monthly: number;
      };
    };
    refundPolicy: {
      allowRefunds: boolean;
      refundWindow: number; // days
      restockingFee?: number;
      conditions: string[];
    };
    taxation: {
      enabled: boolean;
      vatRate?: number;
      salesTaxRate?: number;
      taxIncluded: boolean;
    };
  };
  effectiveFrom: Date;
  effectiveUntil?: Date;
  createdBy: string;
  createdAt: Date;
}

// ==============================================================================
// Payment Provider Interface
// ==============================================================================

/**
 * Abstract payment provider interface
 */
export abstract class PaymentProvider extends EventEmitter {
  protected config: Record<string, any>;
  protected name: string;

  constructor(name: string, config: Record<string, any>) {
    super();
    this.name = name;
    this.config = config;
  }

  /**
   * Initialize the payment provider
   */
  abstract initialize(): Promise<void>;

  /**
   * Create a payment intent
   */
  abstract createPaymentIntent(
    amount: number,
    currency: Currency,
    metadata: Record<string, any>
  ): Promise<PaymentIntent>;

  /**
   * Confirm a payment intent
   */
  abstract confirmPayment(
    paymentIntentId: string,
    paymentMethod: PaymentMethod
  ): Promise<PaymentTransaction>;

  /**
   * Capture a payment (for delayed capture)
   */
  abstract capturePayment(
    paymentIntentId: string,
    amount?: number
  ): Promise<PaymentTransaction>;

  /**
   * Refund a payment
   */
  abstract refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentTransaction>;

  /**
   * Get payment status
   */
  abstract getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus>;

  /**
   * List supported currencies
   */
  abstract getSupportedCurrencies(): Currency[];

  /**
   * List supported payment methods
   */
  abstract getSupportedPaymentMethods(): PaymentMethodType[];

  /**
   * Validate payment method
   */
  abstract validatePaymentMethod(method: PaymentMethod): Promise<boolean>;

  /**
   * Calculate fees for a transaction
   */
  abstract calculateFees(
    amount: number,
    currency: Currency,
    paymentMethod: PaymentMethodType
  ): Promise<{ fee: number; netAmount: number }>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }
}

// ==============================================================================
// Currency Exchange Service
// ==============================================================================

/**
 * Currency exchange service for rate management
 */
export class CurrencyExchangeService extends EventEmitter {
  private rates = new Map<string, ExchangeRate>();
  private providers: Array<{
    name: string;
    fetchRates: () => Promise<ExchangeRate[]>;
    priority: number;
  }> = [];

  /**
   * Add an exchange rate provider
   */
  addProvider(
    name: string,
    fetchRates: () => Promise<ExchangeRate[]>,
    priority: number = 0
  ): void {
    this.providers.push({ name, fetchRates, priority });
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update exchange rates from all providers
   */
  async updateRates(): Promise<void> {
    const allRates = new Map<string, ExchangeRate>();

    for (const provider of this.providers) {
      try {
        const rates = await provider.fetchRates();
        for (const rate of rates) {
          const key = `${rate.fromCurrency.code}:${rate.toCurrency.code}`;
          if (!allRates.has(key) || rate.timestamp > allRates.get(key)!.timestamp) {
            allRates.set(key, rate);
          }
        }
      } catch (error) {
        this.emit('provider-error', provider.name, error);
      }
    }

    // Update stored rates
    for (const [key, rate] of allRates) {
      this.rates.set(key, rate);
    }

    this.emit('rates-updated', allRates.size);
  }

  /**
   * Get exchange rate between currencies
   */
  getRate(fromCurrency: Currency, toCurrency: Currency): ExchangeRate | null {
    if (fromCurrency.code === toCurrency.code) {
      return {
        fromCurrency,
        toCurrency,
        rate: 1,
        timestamp: new Date(),
        source: 'internal',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }

    const directKey = `${fromCurrency.code}:${toCurrency.code}`;
    const directRate = this.rates.get(directKey);
    
    if (directRate && directRate.validUntil > new Date()) {
      return directRate;
    }

    // Try inverse rate
    const inverseKey = `${toCurrency.code}:${fromCurrency.code}`;
    const inverseRate = this.rates.get(inverseKey);
    
    if (inverseRate && inverseRate.validUntil > new Date()) {
      return {
        fromCurrency,
        toCurrency,
        rate: 1 / inverseRate.rate,
        timestamp: inverseRate.timestamp,
        source: inverseRate.source,
        validUntil: inverseRate.validUntil
      };
    }

    return null;
  }

  /**
   * Convert amount between currencies
   */
  convert(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): { amount: number; rate: ExchangeRate } | null {
    const rate = this.getRate(fromCurrency, toCurrency);
    if (!rate) {
      return null;
    }

    return {
      amount: amount * rate.rate,
      rate
    };
  }

  /**
   * Get all current rates
   */
  getAllRates(): ExchangeRate[] {
    return Array.from(this.rates.values())
      .filter(rate => rate.validUntil > new Date());
  }
}

// ==============================================================================
// Payment System Core
// ==============================================================================

/**
 * Main payment system orchestrator
 */
export class PaymentSystem extends EventEmitter {
  private providers = new Map<string, PaymentProvider>();
  private policies = new Map<string, PaymentPolicy>();
  private transactions = new Map<string, PaymentTransaction>();
  private receipts = new Map<string, PaymentReceipt>();
  private exchangeService: CurrencyExchangeService;

  constructor(exchangeService?: CurrencyExchangeService) {
    super();
    this.exchangeService = exchangeService || new CurrencyExchangeService();
  }

  /**
   * Register a payment provider
   */
  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.getName(), provider);
    
    // Forward provider events
    provider.on('payment-success', (transaction) => {
      this.emit('payment-success', provider.getName(), transaction);
    });
    
    provider.on('payment-failed', (error) => {
      this.emit('payment-failed', provider.getName(), error);
    });
  }

  /**
   * Add a payment policy
   */
  addPolicy(policy: PaymentPolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy-added', policy);
  }

  /**
   * Process a payment for a KPack purchase
   */
  async processPayment(
    listingId: string,
    valueVector: ValueVector,
    purchaserId: string,
    publisherId: string,
    paymentMethod: PaymentMethod,
    selectedPricing?: PricingModel
  ): Promise<PaymentReceipt> {
    // Validate payment method and policy
    await this.validatePayment(paymentMethod, valueVector);

    // Select appropriate pricing model
    const pricing = selectedPricing || this.selectOptimalPricing(valueVector, paymentMethod);
    
    // Calculate total amount including fees and taxes
    const { totalAmount, breakdown } = await this.calculateTotalAmount(pricing, paymentMethod);

    // Create payment intent
    const provider = this.selectProvider(paymentMethod);
    const paymentIntent = await provider.createPaymentIntent(
      totalAmount,
      paymentMethod.currency,
      {
        listingId,
        purchaserId,
        publisherId,
        pricingModel: pricing.type
      }
    );

    // Process the payment
    try {
      const transaction = await provider.confirmPayment(paymentIntent.id, paymentMethod);
      
      if (transaction.status === 'completed') {
        // Generate receipt with cryptographic proof
        const receipt = await this.generateReceipt(
          transaction,
          listingId,
          purchaserId,
          publisherId,
          breakdown
        );

        this.receipts.set(receipt.id, receipt);
        this.transactions.set(transaction.id, transaction);

        this.emit('payment-completed', receipt);
        return receipt;
      } else {
        throw new Error(`Payment failed with status: ${transaction.status}`);
      }
    } catch (error) {
      this.emit('payment-error', paymentIntent.id, error);
      throw error;
    }
  }

  /**
   * Process a refund
   */
  async processRefund(
    receiptId: string,
    reason: string,
    amount?: number
  ): Promise<PaymentTransaction> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    const originalTransaction = this.transactions.get(receipt.transactionId);
    if (!originalTransaction) {
      throw new Error('Original transaction not found');
    }

    // Check refund policy
    const policy = await this.getApplicablePolicy(receipt.payment.currency);
    if (!policy?.rules.refundPolicy.allowRefunds) {
      throw new Error('Refunds not allowed for this transaction');
    }

    const refundAmount = amount || originalTransaction.amount;
    const provider = this.providers.get(originalTransaction.gateway);
    if (!provider) {
      throw new Error('Payment provider not found');
    }

    const refundTransaction = await provider.refundPayment(
      originalTransaction.id,
      refundAmount,
      reason
    );

    this.transactions.set(refundTransaction.id, refundTransaction);
    this.emit('refund-processed', refundTransaction);

    return refundTransaction;
  }

  /**
   * Get payment receipt
   */
  getReceipt(receiptId: string): PaymentReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  /**
   * Validate a payment against policies
   */
  private async validatePayment(
    paymentMethod: PaymentMethod,
    valueVector: ValueVector
  ): Promise<void> {
    const policy = await this.getApplicablePolicy(paymentMethod.currency);
    if (!policy) {
      throw new Error('No applicable payment policy found');
    }

    // Check currency support
    if (!policy.rules.allowedCurrencies.some(c => c.code === paymentMethod.currency.code)) {
      throw new Error(`Currency ${paymentMethod.currency.code} not supported`);
    }

    // Check payment method support
    if (!policy.rules.allowedPaymentMethods.includes(paymentMethod.type)) {
      throw new Error(`Payment method ${paymentMethod.type} not supported`);
    }

    // Check verification requirements
    if (policy.rules.requireVerification && !paymentMethod.verified) {
      throw new Error('Payment method must be verified');
    }

    // Additional validation logic...
  }

  /**
   * Select optimal pricing model
   */
  private selectOptimalPricing(
    valueVector: ValueVector,
    paymentMethod: PaymentMethod
  ): PricingModel {
    // Find pricing models that match the payment method currency
    const compatiblePricing = valueVector.pricing.filter(p => {
      if (p.type === 'free') return true;
      return 'currency' in p && p.currency.code === paymentMethod.currency.code;
    });

    if (compatiblePricing.length === 0) {
      throw new Error('No compatible pricing model found');
    }

    // Prefer fixed pricing for simplicity
    return compatiblePricing.find(p => p.type === 'fixed') || compatiblePricing[0];
  }

  /**
   * Calculate total amount including fees and taxes
   */
  private async calculateTotalAmount(
    pricing: PricingModel,
    paymentMethod: PaymentMethod
  ): Promise<{
    totalAmount: number;
    breakdown: {
      baseAmount: number;
      fees: number;
      taxes: number;
      total: number;
    };
  }> {
    if (pricing.type === 'free') {
      return {
        totalAmount: 0,
        breakdown: { baseAmount: 0, fees: 0, taxes: 0, total: 0 }
      };
    }

    const baseAmount = 'price' in pricing ? pricing.price : 0;
    
    // Calculate provider fees
    const provider = this.selectProvider(paymentMethod);
    const { fee } = await provider.calculateFees(
      baseAmount,
      paymentMethod.currency,
      paymentMethod.type
    );

    // Calculate taxes (simplified)
    const policy = await this.getApplicablePolicy(paymentMethod.currency);
    const taxRate = policy?.rules.taxation.vatRate || 0;
    const taxes = policy?.rules.taxation.enabled ? baseAmount * taxRate : 0;

    const total = baseAmount + fee + taxes;

    return {
      totalAmount: total,
      breakdown: {
        baseAmount,
        fees: fee,
        taxes,
        total
      }
    };
  }

  /**
   * Select appropriate payment provider
   */
  private selectProvider(paymentMethod: PaymentMethod): PaymentProvider {
    // Simple provider selection logic
    // In a real implementation, this would be more sophisticated
    const providerName = paymentMethod.provider || Array.from(this.providers.keys())[0];
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Payment provider ${providerName} not found`);
    }

    return provider;
  }

  /**
   * Get applicable payment policy
   */
  private async getApplicablePolicy(currency: Currency): Promise<PaymentPolicy | undefined> {
    // Find the most recent active policy that supports the currency
    const now = new Date();
    const applicablePolicies = Array.from(this.policies.values())
      .filter(policy => 
        policy.effectiveFrom <= now &&
        (!policy.effectiveUntil || policy.effectiveUntil > now) &&
        policy.rules.allowedCurrencies.some(c => c.code === currency.code)
      )
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

    return applicablePolicies[0];
  }

  /**
   * Generate a cryptographically signed receipt
   */
  private async generateReceipt(
    transaction: PaymentTransaction,
    listingId: string,
    purchaserId: string,
    publisherId: string,
    breakdown: { baseAmount: number; fees: number; taxes: number; total: number }
  ): Promise<PaymentReceipt> {
    // This is a simplified implementation
    // In production, you'd use proper cryptographic signing
    
    const receiptId = randomUUID();
    const downloadToken = randomUUID();
    
    const receipt: PaymentReceipt = {
      id: receiptId,
      transactionId: transaction.id,
      purchaser: {
        id: purchaserId,
        name: 'Purchaser Name', // Would be fetched from user service
        email: 'purchaser@example.com'
      },
      publisher: {
        id: publisherId,
        name: 'Publisher Name', // Would be fetched from user service
        email: 'publisher@example.com'
      },
      item: {
        kpackId: 'example-kpack', // Would be fetched from listing
        kpackName: 'Example KPack',
        version: '1.0.0',
        listingId
      },
      payment: {
        amount: transaction.amount,
        currency: transaction.currency,
        method: transaction.gatewayTransactionId as PaymentMethodType, // Simplified
        processedAt: transaction.processedAt
      },
      license: {
        type: 'commercial',
        terms: 'Standard commercial license',
        validFrom: new Date(),
        restrictions: []
      },
      cryptographicProof: {
        signature: 'dummy-signature', // Would be actual signature
        algorithm: 'ed25519',
        publicKey: 'dummy-public-key',
        timestamp: new Date().toISOString(),
        nonce: randomUUID()
      },
      downloadToken,
      receiptUrl: `https://marketplace.kgen.ai/receipts/${receiptId}`,
      supportContact: 'support@kgen.ai'
    };

    return receipt;
  }

  /**
   * Get exchange service
   */
  getExchangeService(): CurrencyExchangeService {
    return this.exchangeService;
  }

  /**
   * Get payment statistics
   */
  getPaymentStats(): {
    totalTransactions: number;
    totalVolume: Record<string, number>;
    successRate: number;
    averageTransactionSize: Record<string, number>;
  } {
    const transactions = Array.from(this.transactions.values());
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'completed');
    
    const volumeByCurrency = new Map<string, number>();
    const countByCurrency = new Map<string, number>();
    
    for (const transaction of successfulTransactions) {
      const currency = transaction.currency.code;
      volumeByCurrency.set(currency, (volumeByCurrency.get(currency) || 0) + transaction.amount);
      countByCurrency.set(currency, (countByCurrency.get(currency) || 0) + 1);
    }

    const averageTransactionSize: Record<string, number> = {};
    for (const [currency, volume] of volumeByCurrency) {
      const count = countByCurrency.get(currency) || 1;
      averageTransactionSize[currency] = volume / count;
    }

    return {
      totalTransactions,
      totalVolume: Object.fromEntries(volumeByCurrency),
      successRate: totalTransactions > 0 ? successfulTransactions.length / totalTransactions : 0,
      averageTransactionSize
    };
  }
}