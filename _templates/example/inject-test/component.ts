---
to: src/components/{{ componentName }}.ts
chmod: "644"
sh: echo "Generated {{ componentName }} component"
---
export interface {{ componentName }}Props {
  title: string;
  visible?: boolean;
}

export class {{ componentName }} {
  constructor(private props: {{ componentName }}Props) {}

  render(): string {
    if (!this.props.visible) return "";
    return `<div class="{{ componentName | kebabCase }}">${this.props.title}</div>`;
  }
}