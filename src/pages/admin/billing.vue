<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Billing & Usage</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your subscription, usage limits, and billing information
        </p>
      </div>

      <!-- Current Plan -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Plan Details -->
        <div class="lg:col-span-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                <UBadge :color="planStatus.color" variant="subtle" class="capitalize">
                  {{ planStatus.status }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-6">
              <!-- Plan Info -->
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-2xl font-bold text-gray-900 dark:text-white">{{ currentPlan.name }}</h4>
                  <p class="text-gray-600 dark:text-gray-400">{{ currentPlan.description }}</p>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold text-gray-900 dark:text-white">${{ currentPlan.price }}</p>
                  <p class="text-gray-600 dark:text-gray-400">/{{ currentPlan.billingCycle }}</p>
                </div>
              </div>

              <!-- Usage Limits -->
              <div class="space-y-4">
                <h5 class="font-medium text-gray-900 dark:text-white">Usage This Month</h5>
                
                <div
                  v-for="usage in usageMetrics"
                  :key="usage.name"
                  class="space-y-2"
                >
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">{{ usage.name }}</span>
                    <span class="font-medium text-gray-900 dark:text-white">
                      {{ usage.current.toLocaleString() }} / {{ usage.limit.toLocaleString() }}{{ usage.unit }}
                    </span>
                  </div>
                  <UProgress 
                    :value="(usage.current / usage.limit) * 100" 
                    :color="getUsageColor(usage.current, usage.limit)"
                  />
                  <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{{ Math.round((usage.current / usage.limit) * 100) }}% used</span>
                    <span v-if="usage.renewsAt">Resets {{ formatDate(usage.renewsAt) }}</span>
                  </div>
                </div>
              </div>

              <!-- Plan Features -->
              <div>
                <h5 class="font-medium text-gray-900 dark:text-white mb-3">Plan Features</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    v-for="feature in currentPlan.features"
                    :key="feature"
                    class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <UIcon name="i-heroicons-check" class="w-4 h-4 text-green-500" />
                    <span>{{ feature }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Billing Actions -->
        <div class="space-y-6">
          <!-- Next Bill -->
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Next Bill</h3>
            </template>

            <div class="space-y-4">
              <div class="text-center">
                <p class="text-3xl font-bold text-gray-900 dark:text-white">${{ nextBill.amount }}</p>
                <p class="text-gray-600 dark:text-gray-400">Due {{ formatDate(nextBill.dueDate) }}</p>
              </div>

              <div class="space-y-2">
                <div
                  v-for="item in nextBill.items"
                  :key="item.name"
                  class="flex justify-between text-sm"
                >
                  <span class="text-gray-600 dark:text-gray-400">{{ item.name }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">${{ item.amount }}</span>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Quick Actions -->
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Billing Actions</h3>
            </template>

            <div class="space-y-3">
              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                icon="i-heroicons-arrow-up-circle"
                @click="showUpgradeModal = true"
              >
                Upgrade Plan
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                icon="i-heroicons-credit-card"
                @click="showPaymentModal = true"
              >
                Update Payment Method
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                icon="i-heroicons-document-arrow-down"
                @click="downloadInvoices"
              >
                Download Invoices
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                icon="i-heroicons-cog-6-tooth"
                @click="showBillingSettings = true"
              >
                Billing Settings
              </UButton>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Billing History -->
      <UCard class="mb-8">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Billing History</h3>
            <div class="flex items-center space-x-2">
              <USelectMenu
                v-model="billingHistoryFilter"
                :options="filterOptions"
                value-attribute="value"
                option-attribute="label"
              />
              <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-path" @click="refreshBillingHistory">
                Refresh
              </UButton>
            </div>
          </div>
        </template>

        <UTable
          :rows="filteredBillingHistory"
          :columns="billingColumns"
          class="w-full"
        >
          <template #date-data="{ row }">
            <span class="text-sm text-gray-900 dark:text-white">{{ formatDate(row.date) }}</span>
          </template>

          <template #status-data="{ row }">
            <UBadge 
              :color="getBillingStatusColor(row.status)" 
              variant="subtle" 
              class="capitalize"
            >
              {{ row.status }}
            </UBadge>
          </template>

          <template #amount-data="{ row }">
            <span class="font-medium text-gray-900 dark:text-white">${{ row.amount }}</span>
          </template>

          <template #actions-data="{ row }">
            <div class="flex items-center space-x-2">
              <UButton
                variant="ghost"
                size="xs"
                icon="i-heroicons-eye"
                @click="viewInvoice(row.id)"
              />
              <UButton
                variant="ghost"
                size="xs"
                icon="i-heroicons-arrow-down-tray"
                @click="downloadInvoice(row.id)"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <!-- Usage Analytics -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Usage Chart -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Usage Trends</h3>
          </template>

          <ChartWidget
            type="line"
            :data="usageChartData"
            height="300"
            class="mt-4"
          />
        </UCard>

        <!-- Cost Breakdown -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Cost Breakdown</h3>
          </template>

          <div class="space-y-4 mt-4">
            <div
              v-for="cost in costBreakdown"
              :key="cost.category"
              class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="flex items-center space-x-3">
                <div class="w-4 h-4 rounded" :style="{ backgroundColor: cost.color }" />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ cost.category }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ cost.description }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-gray-900 dark:text-white">${{ cost.amount }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ cost.percentage }}%</p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Upgrade Modal -->
    <UModal v-model="showUpgradeModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Upgrade Plan</h3>
        </template>

        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            Choose a plan that better fits your organization's needs.
          </p>
          
          <div class="space-y-3">
            <div
              v-for="plan in availablePlans"
              :key="plan.id"
              class="p-4 border rounded-lg cursor-pointer"
              :class="selectedUpgradePlan?.id === plan.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'"
              @click="selectedUpgradePlan = plan"
            >
              <div class="flex justify-between items-center">
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">{{ plan.name }}</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ plan.description }}</p>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold text-gray-900 dark:text-white">${{ plan.price }}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">/month</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end space-x-3">
            <UButton variant="ghost" @click="showUpgradeModal = false">Cancel</UButton>
            <UButton 
              :disabled="!selectedUpgradePlan"
              @click="upgradePlan"
            >
              Upgrade Plan
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import ChartWidget from '~/components/dashboard/ChartWidget.vue'

definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

const showUpgradeModal = ref(false)
const showPaymentModal = ref(false)
const showBillingSettings = ref(false)
const billingHistoryFilter = ref('all')
const selectedUpgradePlan = ref(null)

const currentPlan = ref({
  name: 'Enterprise',
  description: 'Advanced features for large teams',
  price: 499,
  billingCycle: 'month',
  features: [
    'Unlimited templates',
    'Advanced collaboration',
    'Priority support',
    'Custom integrations',
    'SSO & SAML',
    'Audit logs',
    'Advanced analytics'
  ]
})

const planStatus = ref({
  status: 'active',
  color: 'green'
})

const usageMetrics = ref([
  {
    name: 'Code Generations',
    current: 45234,
    limit: 100000,
    unit: '',
    renewsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  },
  {
    name: 'Active Users',
    current: 156,
    limit: 500,
    unit: '',
    renewsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  },
  {
    name: 'Storage',
    current: 47,
    limit: 100,
    unit: ' GB',
    renewsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  },
  {
    name: 'API Calls',
    current: 2840000,
    limit: 5000000,
    unit: '',
    renewsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  }
])

const nextBill = ref({
  amount: 499,
  dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  items: [
    { name: 'Enterprise Plan', amount: 499 },
    { name: 'Additional Storage', amount: 25 },
    { name: 'Premium Support', amount: 99 }
  ]
})

const billingHistory = ref([
  { id: '1', date: new Date('2024-01-15'), description: 'Monthly subscription', amount: 499, status: 'paid', invoiceUrl: '#' },
  { id: '2', date: new Date('2023-12-15'), description: 'Monthly subscription', amount: 499, status: 'paid', invoiceUrl: '#' },
  { id: '3', date: new Date('2023-11-15'), description: 'Monthly subscription', amount: 499, status: 'paid', invoiceUrl: '#' },
  { id: '4', date: new Date('2023-10-15'), description: 'Monthly subscription', amount: 299, status: 'paid', invoiceUrl: '#' },
  { id: '5', date: new Date('2023-09-15'), description: 'Plan upgrade', amount: 200, status: 'paid', invoiceUrl: '#' }
])

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' }
]

const billingColumns = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' }
]

const availablePlans = ref([
  { id: 'pro', name: 'Professional', description: 'Perfect for growing teams', price: 199 },
  { id: 'enterprise-plus', name: 'Enterprise Plus', description: 'Advanced enterprise features', price: 999 }
])

const usageChartData = ref([
  { label: 'Jan', value: 32000 },
  { label: 'Feb', value: 38000 },
  { label: 'Mar', value: 41000 },
  { label: 'Apr', value: 35000 },
  { label: 'May', value: 42000 },
  { label: 'Jun', value: 45000 }
])

const costBreakdown = ref([
  { category: 'Base Plan', description: 'Monthly subscription', amount: 499, percentage: 75, color: '#3B82F6' },
  { category: 'Storage', description: 'Additional storage usage', amount: 89, percentage: 15, color: '#10B981' },
  { category: 'Support', description: 'Premium support add-on', amount: 49, percentage: 8, color: '#F59E0B' },
  { category: 'Overage', description: 'Usage overages', amount: 12, percentage: 2, color: '#EF4444' }
])

const filteredBillingHistory = computed(() => {
  if (billingHistoryFilter.value === 'all') {
    return billingHistory.value
  }
  return billingHistory.value.filter(item => item.status === billingHistoryFilter.value)
})

const getUsageColor = (current: number, limit: number): string => {
  const percentage = (current / limit) * 100
  if (percentage >= 90) return 'red'
  if (percentage >= 75) return 'orange'
  return 'primary'
}

const getBillingStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'paid': 'green',
    'pending': 'yellow',
    'failed': 'red',
    'refunded': 'gray'
  }
  return colors[status] || 'gray'
}

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const viewInvoice = (invoiceId: string) => {
  // Implementation for viewing invoice
  console.log('Viewing invoice:', invoiceId)
}

const downloadInvoice = (invoiceId: string) => {
  // Implementation for downloading invoice
  console.log('Downloading invoice:', invoiceId)
}

const downloadInvoices = () => {
  // Implementation for downloading all invoices
  console.log('Downloading all invoices')
}

const refreshBillingHistory = async () => {
  // Implementation for refreshing billing history
  console.log('Refreshing billing history')
}

const upgradePlan = async () => {
  if (!selectedUpgradePlan.value) return
  
  // Implementation for upgrading plan
  console.log('Upgrading to plan:', selectedUpgradePlan.value)
  showUpgradeModal.value = false
}
</script>