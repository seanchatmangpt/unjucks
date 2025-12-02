Feature: Marketplace Payments
  As a marketplace participant
  I want to handle payments for premium KPacks securely
  So that creators can monetize their work and buyers can access premium content

  Background:
    Given the marketplace payment system is operational
    And I have valid authentication credentials
    And payment adapters are configured and available

  @smoke @payment
  Scenario: Process successful payment for premium KPack
    Given I want to purchase a KPack priced at "$49.99"
    And I have valid payment information
    When I proceed with the purchase
    Then I should be presented with a secure payment form
    And payment should be processed within 3 seconds
    And I should receive a confirmation of successful payment
    And access to the KPack should be granted immediately

  @payment-policies @evaluation
  Scenario: Apply payment policies for purchase decision
    Given a KPack has the following payment policy:
      | policy_type        | value           |
      | trial_period       | 14_days         |
      | refund_period      | 30_days         |
      | enterprise_discount| 20_percent      |
      | volume_pricing     | 5_plus_10_percent|
    And I am an enterprise customer purchasing 10 licenses
    When the payment policy is evaluated
    Then enterprise discount should be applied
    And volume pricing should be calculated
    And final price should reflect both discounts
    And policy terms should be clearly displayed

  @subscription @recurring
  Scenario: Set up recurring subscription payment
    Given a KPack offers subscription pricing at "$19.99/month"
    And I choose the monthly subscription option
    When I complete the subscription setup
    Then a recurring payment should be established
    And I should receive confirmation of the subscription
    And access should be granted for the subscription period
    And I should be able to manage the subscription

  @payment-methods @multiple-adapters
  Scenario: Support multiple payment methods
    Given the marketplace supports various payment adapters:
      | payment_method | adapter_name    |
      | credit_card    | stripe          |
      | paypal         | paypal_standard |
      | crypto         | web3_payments   |
      | bank_transfer  | bank_adapter    |
    When I choose different payment methods
    Then the appropriate adapter should be used
    And payment processing should work correctly for each
    And transaction fees should be calculated properly

  @refunds @dispute-handling
  Scenario: Process refund for returned KPack
    Given I purchased a KPack 15 days ago for "$29.99"
    And the refund policy allows returns within 30 days
    When I request a refund with valid reason
    Then the refund request should be processed
    And the refund should be issued within 5 business days
    And my access to the KPack should be revoked
    And I should receive refund confirmation

  @failed-payments @retry-mechanism
  Scenario: Handle failed payment with retry
    Given I attempt to purchase a KPack for "$15.99"
    And my payment method is declined initially
    When the payment fails
    Then I should receive a clear error message
    And be offered alternative payment methods
    And have the option to retry with corrected information
    And the purchase attempt should not be duplicated

  @pricing-tiers @dynamic-pricing
  Scenario: Apply dynamic pricing based on user tier
    Given I am a verified enterprise customer
    And there is a KPack with tiered pricing:
      | tier       | price   | features           |
      | individual | $9.99   | basic_access       |
      | team       | $29.99  | team_collaboration |
      | enterprise | $99.99  | full_suite         |
    When I view the KPack pricing
    Then enterprise pricing should be displayed prominently
    And enterprise features should be highlighted
    And appropriate tier should be pre-selected

  @bundle-pricing @package-deals
  Scenario: Purchase KPack bundle with discount
    Given there is a bundle containing 3 KPacks:
      | kpack_name        | individual_price |
      | data-analysis     | $19.99          |
      | visualization     | $24.99          |
      | reporting-tools   | $29.99          |
    And the bundle price is "$59.99" (20% discount)
    When I purchase the bundle
    Then the discounted price should be applied
    And all KPacks in the bundle should be available
    And bundle purchase should be recorded correctly

  @revenue-sharing @creator-payments
  Scenario: Distribute revenue to KPack creators
    Given a KPack sale generates "$100" in revenue
    And the revenue sharing model is:
      | party        | percentage |
      | creator      | 70%        |
      | marketplace  | 25%        |
      | payment_fees | 5%         |
    When the payment is processed
    Then revenue should be distributed according to the model
    And creator should receive $70
    And marketplace should receive $25
    And payment fees should be deducted appropriately

  @audit-trail @transaction-logging
  Scenario: Maintain complete payment audit trail
    Given I make multiple purchases over time
    When I purchase KPacks and manage subscriptions
    Then all payment transactions should be logged
    And audit trail should include:
      | field              |
      | transaction_id     |
      | timestamp          |
      | amount             |
      | payment_method     |
      | kpack_details      |
      | user_id           |
    And logs should be tamper-proof and immutable

  @tax-calculation @compliance
  Scenario: Calculate and apply appropriate taxes
    Given I am purchasing from a jurisdiction that requires tax
    And my billing address indicates 8.5% sales tax
    When I proceed with a $50 purchase
    Then sales tax should be calculated correctly ($4.25)
    And total amount should be $54.25
    And tax details should be clearly itemized
    And tax compliance should be maintained

  @payment-security @fraud-prevention
  Scenario: Detect and prevent fraudulent payments
    Given the system monitors for suspicious payment patterns
    When an unusual payment pattern is detected:
      | indicator           | value    |
      | multiple_attempts   | 5_in_1min|
      | high_value_purchase | $500+    |
      | new_payment_method  | true     |
    Then fraud detection should be triggered
    And additional verification should be required
    And suspicious activity should be logged
    And legitimate users should not be unduly inconvenienced

  @wallet-integration @crypto-payments
  Scenario: Process cryptocurrency payment
    Given a user wants to pay with cryptocurrency
    And the KPack is priced at "$25 USD equivalent"
    When they choose crypto payment option
    Then the system should calculate current exchange rate
    And display the equivalent crypto amount
    And generate a payment address or QR code
    And confirm payment after blockchain confirmation
    And handle exchange rate fluctuations appropriately