// Generated from semantic ontology: ex:hasName
// Entity: has name
// Type: owl:DatatypeProperty

class HasName {
  constructor(data = {}) {
    this.id = data.id;
  }

  // Semantic methods
  getSemanticType() {
    return 'owl:DatatypeProperty';
  }

  getSemanticId() {
    return 'ex:hasName';
  }

  toRDF() {
    return `${this.id} rdf:type owl:DatatypeProperty .`;
  }
}

module.exports = HasName;
