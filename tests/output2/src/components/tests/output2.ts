export interface tests/output2Props {
  title: string;
  visible?: boolean;
}

export class tests/output2 {
  constructor(private props: tests/output2Props) {}

  render(): string {
    if (!this.props.visible) return "";
    return `<div class="tests/output2">${this.props.title}</div>`;
  }
}