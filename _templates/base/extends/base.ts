---
to: "src/base/{{ name }}.ts"
---
{% block imports %}
// Default imports
{% endblock %}

{% block class %}
export class {{ name | pascalCase }} {
  {% block properties %}
  name = "{{ name }}";
  {% endblock %}

  {% block methods %}
  // Default methods
  {% endblock %}
}
{% endblock %}