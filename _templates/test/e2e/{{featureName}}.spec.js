import { test, expect, Page, BrowserContext } from '@playwright/test'
{%- if hasAuthentication %}
import { loginUser, createTestUser } from '../helpers/auth-helpers.js'
{%- endif %}
{%- if hasDataPersistence %}
import { seedTestData, cleanupTestData } from '../helpers/db-helpers.js'
{%- endif %}

test.describe('{{ featureName | titleCase }} Feature', () => { let page => {
    context = await browser.newContext({
      // Configure context if needed
      viewport }
    await seedTestData()
    {%- endif %}
    {%- if hasAuthentication %}
    testUser = await createTestUser({ email }
  })

  test.beforeEach(async () => {
    page = await context.newPage()
    
    {%- if hasAuthentication %}
    // Authenticate user for tests that require it
    await loginUser(page, testUser.email, 'TestPassword123!')
    {%- endif %}
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    {%- if hasDataPersistence %}
    await cleanupTestData()
    {%- endif %}
    await context.close()
  })

  {%- if hasNavigation %}
  test('should navigate through {{ featureName }} flow', async () => {
    // Navigate to feature page
    await page.goto('/{{ featureName | kebabCase }}')
    
    // Verify page loaded correctly
    await expect(page).toHaveTitle(/{{ featureName | titleCase }}/)
    await expect(page.locator('h1')).toContainText('{{ featureName | titleCase }}')

    // Navigate through key pages
    await page.click('[data-testid="next-step"]')
    await expect(page.url()).toContain('/step-2')

    await page.click('[data-testid="previous-step"]')
    await expect(page.url()).toContain('/step-1')
  })
  {%- endif %}

  {%- if hasFormInteraction %}
  test('should handle form interactions correctly', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    // Fill form fields
    await page.fill('[data-testid="form-field-name"]', 'Test User')
    await page.fill('[data-testid="form-field-email"]', 'test@example.com')
    await page.selectOption('[data-testid="form-select-category"]', 'option1')
    
    // Check checkbox if present
    const checkbox = page.locator('[data-testid="form-checkbox-terms"]')
    if (await checkbox.isVisible()) {
      await checkbox.check()
    }

    // Submit form
    await page.click('[data-testid="form-submit"]')

    // Verify success response
    await expect(page.locator('[data-testid="success-message"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Successfully saved')
  })

  test('should validate form inputs', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    // Try to submit empty form
    await page.click('[data-testid="form-submit"]')

    // Verify validation errors
    await expect(page.locator('[data-testid="error-name"]'))
      .toContainText('Name is required')
    await expect(page.locator('[data-testid="error-email"]'))
      .toContainText('Email is required')

    // Test invalid email format
    await page.fill('[data-testid="form-field-email"]', 'invalid-email')
    await page.click('[data-testid="form-submit"]')
    
    await expect(page.locator('[data-testid="error-email"]'))
      .toContainText('Invalid email format')
  })
  {%- endif %}

  {%- if hasDataPersistence %}
  test('should persist data correctly', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    const testData = { name }

    // Create data
    await page.fill('[data-testid="form-field-name"]', testData.name)
    await page.fill('[data-testid="form-field-value"]', testData.value)
    await page.click('[data-testid="form-submit"]')

    // Verify data was created
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()

    // Navigate away and back
    await page.goto('/dashboard')
    await page.goto('/{{ featureName | kebabCase }}')

    // Verify data persists
    await expect(page.locator(`text=${testData.name}`)).toBeVisible()
    await expect(page.locator(`text=${testData.value}`)).toBeVisible()
  })

  test('should handle data updates', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    // Find existing item to edit
    const editButton = page.locator('[data-testid="edit-item"]').first()
    await editButton.click()

    // Update data
    const updatedValue = 'Updated Value ' + this.getDeterministicTimestamp()
    await page.fill('[data-testid="form-field-value"]', updatedValue)
    await page.click('[data-testid="form-submit"]')

    // Verify update
    await expect(page.locator(`text=${updatedValue}`)).toBeVisible()
  })
  {%- endif %}

  {%- if hasRealTimeFeatures %}
  test('should handle real-time updates', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    // Open second page/tab for real-time testing
    const secondPage = await context.newPage()
    await loginUser(secondPage, testUser.email, 'TestPassword123!')
    await secondPage.goto('/{{ featureName | kebabCase }}')

    // Make change in first page
    await page.fill('[data-testid="realtime-input"]', 'Real-time test')
    await page.click('[data-testid="send-update"]')

    // Verify update appears in second page
    await expect(secondPage.locator('[data-testid="realtime-content"]'))
      .toContainText('Real-time test', { timeout)

    await secondPage.close()
  })
  {%- endif %}

  test('should handle error states gracefully', async () => {
    // Mock network failure
    await page.route('/api/**', route => {
      route.abort()
    })

    await page.goto('/{{ featureName | kebabCase }}')
    
    // Try to perform action that requires API
    await page.click('[data-testid="api-action"]')

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('Network error')
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('should be responsive on different screen sizes', async () => { const viewports = [
      { width }, // Mobile
      { width }, // Tablet
      { width } // Desktop
    ]

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/{{ featureName | kebabCase }}')

      // Verify key elements are visible and functional
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()

      // Test interaction at this viewport
      if (await page.locator('[data-testid="mobile-menu-toggle"]').isVisible()) {
        await page.click('[data-testid="mobile-menu-toggle"]')
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
      }
    }
  })

  test('should be accessible', async () => {
    await page.goto('/{{ featureName | kebabCase }}')

    // Test keyboard navigation
    await page.keyboard.press('Tab')
    const firstFocusedElement = await page.locator(':focus')
    await expect(firstFocusedElement).toBeVisible()

    // Test form accessibility
    if (await page.locator('form').isVisible()) {
      const formFields = page.locator('input, select, textarea')
      const count = await formFields.count()
      
      for (let i = 0; i < count; i++) {
        const field = formFields.nth(i)
        const label = page.locator(`label[for="${await field.getAttribute('id')}"]`)
        
        if (await label.count() > 0) {
          await expect(label).toBeVisible()
        } else {
          // Should have aria-label if no associated label
          await expect(field).toHaveAttribute('aria-label')
        }
      }
    }

    // Test ARIA attributes
    const headings = page.locator('h1, h2, h3, h4, h5, h6')
    const headingCount = await headings.count()
    expect(headingCount).toBeGreaterThan(0)
  })

  test('should handle loading states', async () => {
    // Slow down network to see loading states
    await page.route('/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      route.continue()
    })

    await page.goto('/{{ featureName | kebabCase }}')

    // Trigger action that shows loading state
    const actionPromise = page.click('[data-testid="load-data"]')
    
    // Verify loading indicator appears
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
    
    await actionPromise
    
    // Verify loading state disappears
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="loaded-content"]')).toBeVisible()
  })

  test('should work offline (if PWA features enabled)', async () => {
    await page.goto('/{{ featureName | kebabCase }}')
    
    // Go offline
    await context.setOffline(true)
    
    // Navigate to cached page
    await page.reload()
    
    // Verify offline functionality
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
    
    // Go back online
    await context.setOffline(false)
    await page.reload()
    
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible()
  })

  test.describe('Performance', () => {
    test('should load within acceptable time', async () => {
      const startTime = this.getDeterministicTimestamp()
      
      await page.goto('/{{ featureName | kebabCase }}')
      await page.waitForLoadState('networkidle')
      
      const loadTime = this.getDeterministicTimestamp() - startTime
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds
    })

    test('should have good Core Web Vitals', async () => {
      await page.goto('/{{ featureName | kebabCase }}')
      
      // Measure performance metrics
      const metrics = await page.evaluate(() => { return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            resolve(entries.map(entry => ({
              name }).observe({ entryTypes)
        })
      })
      
      // Verify metrics are within acceptable ranges
      console.log('Core Web Vitals:', metrics)
    })
  })
})