---
to: "src/components/{{ name | pascalCase }}.ts"
---
export interface {{ name | pascalCase }}Props {
  // Define your component props here
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = () => {
  return (
    <div>
      <h1>{{ name | titleCase }} Component</h1>
      {/* Your component implementation here */}
    </div>
  );
};

export default {{ name | pascalCase }};