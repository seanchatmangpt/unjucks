<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
        <p class="text-gray-600 dark:text-gray-400">Manage users and their permissions</p>
      </div>
      <UButton icon="i-heroicons-plus" @click="showInviteModal = true">
        Invite User
      </UButton>
    </div>

    <!-- Filters -->
    <UCard>
      <div class="flex items-center justify-between space-x-4">
        <div class="flex items-center space-x-4">
          <UInput
            v-model="search"
            placeholder="Search users..."
            icon="i-heroicons-magnifying-glass"
            class="w-64"
          />
          <USelect
            v-model="roleFilter"
            :options="roleOptions"
            placeholder="All Roles"
            class="w-40"
          />
          <USelect
            v-model="statusFilter"
            :options="statusOptions"
            placeholder="All Status"
            class="w-40"
          />
        </div>
        <div class="flex items-center space-x-2">
          <UButton variant="outline" icon="i-heroicons-funnel" @click="showFilters = !showFilters">
            Filters
          </UButton>
          <UButton variant="outline" icon="i-heroicons-arrow-down-tray">
            Export
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Users Table -->
    <UCard>
      <UTable
        :rows="filteredUsers"
        :columns="columns"
        :loading="loading"
        @select="selectedUsers = $event"
      >
        <template #name-data="{ row }">
          <div class="flex items-center space-x-3">
            <UAvatar :src="row.avatar" :alt="row.name" size="sm" />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ row.email }}</p>
            </div>
          </div>
        </template>

        <template #role-data="{ row }">
          <UBadge
            :color="getRoleColor(row.role.name)"
            variant="subtle"
            class="capitalize"
          >
            {{ row.role.name }}
          </UBadge>
        </template>

        <template #status-data="{ row }">
          <UBadge
            :color="getStatusColor(row.status)"
            variant="subtle"
            class="capitalize"
          >
            {{ row.status }}
          </UBadge>
        </template>

        <template #lastActive-data="{ row }">
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-2 h-2 rounded-full',
                isUserOnline(row.lastActive) ? 'bg-green-400' : 'bg-gray-300'
              ]"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400">
              {{ formatLastActive(row.lastActive) }}
            </span>
          </div>
        </template>

        <template #actions-data="{ row }">
          <UDropdown :items="getUserActions(row)">
            <UButton variant="ghost" size="sm" square>
              <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
            </UButton>
          </UDropdown>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between mt-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalUsers) }} 
          of {{ totalUsers }} users
        </p>
        <UPagination
          v-model="currentPage"
          :page-count="pageSize"
          :total="totalUsers"
        />
      </div>
    </UCard>

    <!-- Bulk Actions -->
    <div v-if="selectedUsers.length > 0" class="fixed bottom-4 left-1/2 transform -translate-x-1/2">
      <UCard class="px-4 py-2 shadow-lg">
        <div class="flex items-center space-x-4">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ selectedUsers.length }} user{{ selectedUsers.length === 1 ? '' : 's' }} selected
          </span>
          <div class="flex items-center space-x-2">
            <UButton size="sm" variant="outline" @click="bulkAction('enable')">
              Enable
            </UButton>
            <UButton size="sm" variant="outline" @click="bulkAction('disable')">
              Disable
            </UButton>
            <UButton size="sm" color="red" variant="outline" @click="bulkAction('delete')">
              Delete
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Invite User Modal -->
    <UModal v-model="showInviteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Invite User</h3>
        </template>

        <UForm :state="inviteForm" @submit="inviteUser" class="space-y-4">
          <UFormGroup label="Email" name="email" required>
            <UInput
              v-model="inviteForm.email"
              type="email"
              placeholder="user@example.com"
              autocomplete="email"
            />
          </UFormGroup>

          <UFormGroup label="Role" name="role" required>
            <USelect
              v-model="inviteForm.role"
              :options="availableRoles"
              option-attribute="name"
              value-attribute="id"
              placeholder="Select a role"
            />
          </UFormGroup>

          <UFormGroup label="Message" name="message">
            <UTextarea
              v-model="inviteForm.message"
              placeholder="Optional welcome message..."
              :rows="3"
            />
          </UFormGroup>

          <div class="flex items-center space-x-2">
            <UCheckbox v-model="inviteForm.sendEmail" />
            <label class="text-sm text-gray-700 dark:text-gray-300">
              Send invitation email
            </label>
          </div>
        </UForm>

        <template #footer>
          <div class="flex justify-end space-x-2">
            <UButton variant="outline" @click="showInviteModal = false">
              Cancel
            </UButton>
            <UButton @click="inviteUser" :loading="inviting">
              Send Invitation
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Edit User Modal -->
    <UModal v-model="showEditModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit User</h3>
        </template>

        <UForm v-if="editingUser" :state="editForm" @submit="updateUser" class="space-y-4">
          <UFormGroup label="Name" name="name" required>
            <UInput v-model="editForm.name" placeholder="Full name" />
          </UFormGroup>

          <UFormGroup label="Email" name="email" required>
            <UInput v-model="editForm.email" type="email" placeholder="user@example.com" />
          </UFormGroup>

          <UFormGroup label="Role" name="role" required>
            <USelect
              v-model="editForm.role"
              :options="availableRoles"
              option-attribute="name"
              value-attribute="id"
            />
          </UFormGroup>

          <UFormGroup label="Status" name="status">
            <USelect
              v-model="editForm.status"
              :options="['active', 'inactive', 'suspended']"
            />
          </UFormGroup>
        </UForm>

        <template #footer>
          <div class="flex justify-end space-x-2">
            <UButton variant="outline" @click="showEditModal = false">
              Cancel
            </UButton>
            <UButton @click="updateUser" :loading="updating">
              Update User
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { User, UserRole } from '~/types'

const { $fetch } = useNuxtApp()

const loading = ref(true)
const inviting = ref(false)
const updating = ref(false)
const showInviteModal = ref(false)
const showEditModal = ref(false)
const showFilters = ref(false)

const search = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(25)
const selectedUsers = ref<User[]>([])

const users = ref<User[]>([])
const availableRoles = ref<UserRole[]>([])
const editingUser = ref<User | null>(null)

const inviteForm = reactive({
  email: '',
  role: '',
  message: '',
  sendEmail: true
})

const editForm = reactive({
  name: '',
  email: '',
  role: '',
  status: 'active'
})

const columns = [
  { key: 'name', label: 'User', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastActive', label: 'Last Active', sortable: true },
  { key: 'actions', label: 'Actions' }
]

const roleOptions = computed(() => [
  { label: 'All Roles', value: '' },
  ...availableRoles.value.map(role => ({ label: role.name, value: role.id }))
])

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' }
]

const filteredUsers = computed(() => {
  let filtered = users.value

  if (search.value) {
    filtered = filtered.filter(user =>
      user.name.toLowerCase().includes(search.value.toLowerCase()) ||
      user.email.toLowerCase().includes(search.value.toLowerCase())
    )
  }

  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role.id === roleFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(user => user.status === statusFilter.value)
  }

  return filtered
})

const totalUsers = computed(() => filteredUsers.value.length)

const fetchUsers = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/admin/users')
    users.value = data.users
    availableRoles.value = data.roles
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loading.value = false
  }
}

const inviteUser = async () => {
  inviting.value = true
  try {
    await $fetch('/api/admin/users/invite', {
      method: 'POST',
      body: inviteForm
    })
    
    useToast().add({
      title: 'Invitation sent',
      description: `Invitation sent to ${inviteForm.email}`,
      color: 'green'
    })
    
    showInviteModal.value = false
    Object.assign(inviteForm, { email: '', role: '', message: '', sendEmail: true })
  } catch (error) {
    useToast().add({
      title: 'Failed to send invitation',
      description: 'Please try again later',
      color: 'red'
    })
  } finally {
    inviting.value = false
  }
}

const editUser = (user: User) => {
  editingUser.value = user
  Object.assign(editForm, {
    name: user.name,
    email: user.email,
    role: user.role.id,
    status: user.status
  })
  showEditModal.value = true
}

const updateUser = async () => {
  if (!editingUser.value) return
  
  updating.value = true
  try {
    const updatedUser = await $fetch(`/api/admin/users/${editingUser.value.id}`, {
      method: 'PUT',
      body: editForm
    })
    
    const index = users.value.findIndex(u => u.id === editingUser.value?.id)
    if (index !== -1) {
      users.value[index] = updatedUser
    }
    
    useToast().add({
      title: 'User updated',
      description: 'User information has been updated',
      color: 'green'
    })
    
    showEditModal.value = false
    editingUser.value = null
  } catch (error) {
    useToast().add({
      title: 'Update failed',
      description: 'Failed to update user',
      color: 'red'
    })
  } finally {
    updating.value = false
  }
}

const deleteUser = async (user: User) => {
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    users.value = users.value.filter(u => u.id !== user.id)
    
    useToast().add({
      title: 'User deleted',
      description: `${user.name} has been deleted`,
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Delete failed',
      description: 'Failed to delete user',
      color: 'red'
    })
  }
}

const bulkAction = async (action: string) => {
  try {
    await $fetch('/api/admin/users/bulk', {
      method: 'POST',
      body: {
        action,
        userIds: selectedUsers.value.map(u => u.id)
      }
    })
    
    useToast().add({
      title: 'Bulk action completed',
      description: `${action} applied to ${selectedUsers.value.length} users`,
      color: 'green'
    })
    
    selectedUsers.value = []
    await fetchUsers()
  } catch (error) {
    useToast().add({
      title: 'Bulk action failed',
      description: 'Failed to perform bulk action',
      color: 'red'
    })
  }
}

const getUserActions = (user: User) => [
  [{
    label: 'Edit User',
    icon: 'i-heroicons-pencil-square',
    click: () => editUser(user)
  }],
  [{
    label: 'Reset Password',
    icon: 'i-heroicons-key',
    click: () => resetPassword(user)
  }, {
    label: 'View Activity',
    icon: 'i-heroicons-eye',
    click: () => navigateTo(`/admin/users/${user.id}/activity`)
  }],
  [{
    label: 'Delete User',
    icon: 'i-heroicons-trash',
    click: () => deleteUser(user)
  }]
]

const resetPassword = async (user: User) => {
  try {
    await $fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
    
    useToast().add({
      title: 'Password reset sent',
      description: `Password reset email sent to ${user.email}`,
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Reset failed',
      description: 'Failed to send password reset',
      color: 'red'
    })
  }
}

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    'admin': 'red',
    'editor': 'blue',
    'viewer': 'gray',
    'developer': 'purple'
  }
  return colors[role.toLowerCase()] || 'gray'
}

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'active': 'green',
    'inactive': 'gray',
    'suspended': 'red'
  }
  return colors[status] || 'gray'
}

const isUserOnline = (lastActive: Date): boolean => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  return new Date(lastActive) > fiveMinutesAgo
}

const formatLastActive = (lastActive: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(lastActive).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Online'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

onMounted(() => {
  fetchUsers()
})
</script>