export interface TestComponentProps {
  title: string;
  visible?: boolean;
}

export class TestComponent {
  constructor(private props: TestComponentProps) {}

  render(): string {
    if (!this.props.visible) return "";
    return `<div class="test-component">${this.props.title}</div>`;
  }
}