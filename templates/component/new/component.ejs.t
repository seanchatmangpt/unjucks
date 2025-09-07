---
to: src/components/<%= name %>.js
---
// Component: <%= name %>
export default function <%= name %>() {
  return (
    <div className="<%= name.toLowerCase() %>">
      <h2><%= name %> Component</h2>
    </div>
  );
}