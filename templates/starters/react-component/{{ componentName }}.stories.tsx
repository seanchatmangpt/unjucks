---
to: {{ componentName }}.stories.tsx  
skipIf: "{{ withStorybook === false }}"
---
import type { Meta, StoryObj } from '@storybook/react';
import { {{ componentName }} } from './{{ componentName }}';

const meta = {
  title: 'Components/{{ componentName }}',
  component: {{ componentName }},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '{{ description }}'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    {% if withProps %}className: {
      control: 'text',
      description: 'Custom CSS className'
    },
    disabled: {
      control: 'boolean', 
      description: 'Whether the component is disabled'
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler function'
    }{% endif %}
  },
} satisfies Meta<typeof {{ componentName }}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    {% if withProps %}disabled: false{% endif %}
  },
};

{% if withProps %}export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const WithChildren: Story = {
  args: {
    children: 'Custom content inside {{ componentName }}',
  },
};

export const WithCustomClass: Story = {
  args: {
    className: 'custom-styling',
    children: 'Styled {{ componentName }}',
  },
};{% endif %}