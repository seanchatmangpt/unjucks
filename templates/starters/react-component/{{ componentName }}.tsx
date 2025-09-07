import React{% if cssModule %}, { CSSProperties }{% endif %} from 'react';
{% if cssModule %}import styles from './{{ componentName }}.module.css';{% endif %}

{% if withProps %}interface {{ componentName }}Props {
  /**
   * {{ description }}
   */
  children?: React.ReactNode;
  /**
   * Custom className for styling
   */
  className?: string;
  /**
   * Custom styles
   */
  style?: CSSProperties;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
}

{% endif %}/**
 * {{ description }}
 */
export const {{ componentName }}: React.FC<{% if withProps %}{{ componentName }}Props{% else %}any{% endif %}> = ({
  {% if withProps %}children,
  className,
  style,
  onClick,
  disabled = false,
  ...props{% else %}...props{% endif %}
}) => {
  return (
    <div
      className={{% if cssModule %}[styles.{{ componentName | camelCase }}, className].filter(Boolean).join(' '){% else %}`{{ componentName | kebabCase }}${className ? ` ${className}` : ''}`{% endif %}}
      style={style}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {{ componentName }} Component
      {% if withProps %}{children}{% endif %}
    </div>
  );
};

export default {{ componentName }};