<template>
  <div class="space-y-6">
    <!-- Organization Info -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Organization Information</h3>
      </template>

      <UForm :state="orgForm" @submit="updateOrganization" class="space-y-4">
        <UFormGroup label="Organization Name" name="name" required>
          <UInput v-model="orgForm.name" placeholder="Enter organization name" />
        </UFormGroup>

        <UFormGroup label="Organization Slug" name="slug" required>
          <UInput v-model="orgForm.slug" placeholder="organization-slug" />
          <template #hint>
            This will be used in your organization's URL: {{ baseUrl }}/{{ orgForm.slug }}
          </template>
        </UFormGroup>

        <UFormGroup label="Primary Domain" name="domain">
          <UInput v-model="orgForm.domain" placeholder="example.com" />
        </UFormGroup>

        <UFormGroup label="Plan" name="plan">
          <USelect
            v-model="orgForm.plan"
            :options="planOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormGroup>

        <div class="flex justify-end">
          <UButton type="submit" :loading="updating">
            Update Organization
          </UButton>
        </div>
      </UForm>
    </UCard>

    <!-- Security Settings -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h3>
      </template>

      <div class="space-y-6">
        <!-- SSO Configuration -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white">Single Sign-On (SSO)</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">Enable SAML or OIDC authentication</p>
            </div>
            <UToggle v-model="securitySettings.ssoEnabled" />
          </div>

          <div v-if="securitySettings.ssoEnabled" class="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
            <UFormGroup label="SSO Provider" name="ssoProvider">
              <USelect
                v-model="securitySettings.ssoProvider"
                :options="ssoProviders"
                placeholder="Select SSO provider"
              />
            </UFormGroup>

            <UFormGroup label="SSO URL" name="ssoUrl">
              <UInput v-model="securitySettings.ssoUrl" placeholder="https://sso.example.com" />
            </UFormGroup>

            <UFormGroup label="Entity ID" name="entityId">
              <UInput v-model="securitySettings.entityId" placeholder="entity-id" />
            </UFormGroup>
          </div>
        </div>

        <!-- Domain Restrictions -->
        <div>
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">Allowed Email Domains</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Restrict user registration to specific email domains
          </p>
          
          <div class="space-y-2">
            <div
              v-for="(domain, index) in securitySettings.allowedDomains"
              :key="index"
              class="flex items-center space-x-2"
            >
              <UInput v-model="securitySettings.allowedDomains[index]" placeholder="example.com" />
              <UButton
                variant="ghost"
                size="sm"
                icon="i-heroicons-trash"
                @click="securitySettings.allowedDomains.splice(index, 1)"
              />
            </div>
            
            <UButton
              variant="outline"
              size="sm"
              icon="i-heroicons-plus"
              @click="securitySettings.allowedDomains.push('')"
            >
              Add Domain
            </UButton>
          </div>
        </div>

        <!-- Audit Settings -->
        <div>
          <h4 class="font-medium text-gray-900 dark:text-white mb-2">Audit Log Retention</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            How long to keep audit logs (in days)
          </p>
          
          <UFormGroup label="Retention Period" name="auditRetention">
            <UInput
              v-model.number="securitySettings.auditRetention"
              type="number"
              placeholder="90"
              min="30"
              max="365"
            />
          </UFormGroup>
        </div>

        <div class="flex justify-end">
          <UButton @click="updateSecuritySettings" :loading="updatingSecurity">
            Update Security Settings
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- API Limits -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">API Rate Limits</h3>
      </template>

      <div class="space-y-4">
        <UFormGroup label="Requests per minute" name="requestsPerMinute">
          <UInput
            v-model.number="apiLimits.requestsPerMinute"
            type="number"
            placeholder="1000"
            min="10"
          />
        </UFormGroup>

        <UFormGroup label="Requests per hour" name="requestsPerHour">
          <UInput
            v-model.number="apiLimits.requestsPerHour"
            type="number"
            placeholder="10000"
            min="100"
          />
        </UFormGroup>

        <UFormGroup label="Requests per day" name="requestsPerDay">
          <UInput
            v-model.number="apiLimits.requestsPerDay"
            type="number"
            placeholder="100000"
            min="1000"
          />
        </UFormGroup>

        <div class="flex justify-end">
          <UButton @click="updateApiLimits" :loading="updatingLimits">
            Update API Limits
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Danger Zone -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
      </template>

      <div class="space-y-4">
        <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h4 class="font-medium text-red-900 dark:text-red-400 mb-2">Delete Organization</h4>
          <p class="text-sm text-red-700 dark:text-red-300 mb-4">
            Once you delete an organization, there is no going back. This will permanently delete
            all templates, users, and data associated with this organization.
          </p>
          <UButton
            color="red"
            variant="outline"
            @click="showDeleteModal = true"
          >
            Delete Organization
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">Delete Organization</h3>
        </template>

        <div class="space-y-4">
          <p class="text-gray-700 dark:text-gray-300">
            This action cannot be undone. This will permanently delete the organization
            <strong>{{ organization?.name }}</strong> and all associated data.
          </p>

          <UFormGroup label="Type the organization name to confirm" name="confirmName" required>
            <UInput
              v-model="deleteConfirmation"
              :placeholder="organization?.name"
              autocomplete="off"
            />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end space-x-2">
            <UButton variant="outline" @click="showDeleteModal = false">
              Cancel
            </UButton>
            <UButton
              color="red"
              :disabled="deleteConfirmation !== organization?.name"
              :loading="deleting"
              @click="deleteOrganization"
            >
              Delete Organization
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Organization, OrganizationSettings, ApiLimits } from '~/types'

const { organization } = useAuth()
const { $fetch } = useNuxtApp()

const baseUrl = 'https://app.unjucks.com'

const updating = ref(false)
const updatingSecurity = ref(false)
const updatingLimits = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const deleteConfirmation = ref('')

const orgForm = reactive({
  name: organization.value?.name || '',
  slug: organization.value?.slug || '',
  domain: organization.value?.domain || '',
  plan: organization.value?.plan || 'starter'
})

const securitySettings = reactive({
  ssoEnabled: organization.value?.settings.ssoEnabled || false,
  ssoProvider: '',
  ssoUrl: '',
  entityId: '',
  allowedDomains: organization.value?.settings.allowedDomains || [''],
  auditRetention: organization.value?.settings.auditRetention || 90
})

const apiLimits = reactive({
  requestsPerMinute: organization.value?.settings.apiLimits.requestsPerMinute || 1000,
  requestsPerHour: organization.value?.settings.apiLimits.requestsPerHour || 10000,
  requestsPerDay: organization.value?.settings.apiLimits.requestsPerDay || 100000
})

const planOptions = [
  { label: 'Starter', value: 'starter' },
  { label: 'Pro', value: 'pro' },
  { label: 'Enterprise', value: 'enterprise' }
]

const ssoProviders = [
  'SAML',
  'OIDC',
  'Azure AD',
  'Google Workspace',
  'Okta',
  'Auth0'
]

const updateOrganization = async () => {
  updating.value = true
  try {
    await $fetch(`/api/organizations/${organization.value?.id}`, {
      method: 'PUT',
      body: orgForm
    })
    
    useToast().add({
      title: 'Organization updated',
      description: 'Organization information has been updated successfully',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Update failed',
      description: 'Failed to update organization information',
      color: 'red'
    })
  } finally {
    updating.value = false
  }
}

const updateSecuritySettings = async () => {
  updatingSecurity.value = true
  try {
    await $fetch(`/api/organizations/${organization.value?.id}/security`, {
      method: 'PUT',
      body: securitySettings
    })
    
    useToast().add({
      title: 'Security settings updated',
      description: 'Security settings have been updated successfully',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Update failed',
      description: 'Failed to update security settings',
      color: 'red'
    })
  } finally {
    updatingSecurity.value = false
  }
}

const updateApiLimits = async () => {
  updatingLimits.value = true
  try {
    await $fetch(`/api/organizations/${organization.value?.id}/limits`, {
      method: 'PUT',
      body: apiLimits
    })
    
    useToast().add({
      title: 'API limits updated',
      description: 'API rate limits have been updated successfully',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Update failed',
      description: 'Failed to update API limits',
      color: 'red'
    })
  } finally {
    updatingLimits.value = false
  }
}

const deleteOrganization = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/organizations/${organization.value?.id}`, {
      method: 'DELETE'
    })
    
    useToast().add({
      title: 'Organization deleted',
      description: 'Organization has been deleted successfully',
      color: 'green'
    })
    
    await navigateTo('/auth/login')
  } catch (error) {
    useToast().add({
      title: 'Delete failed',
      description: 'Failed to delete organization',
      color: 'red'
    })
  } finally {
    deleting.value = false
    showDeleteModal.value = false
  }
}
</script>