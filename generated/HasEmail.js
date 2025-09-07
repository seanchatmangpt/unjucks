// Generated from semantic ontology: ex:hasEmail
// Entity: has email
// Type: owl:DatatypeProperty

class HasEmail {
  constructor(data = {}) {
    this.id = data.id;
  }

  // Semantic methods
  getSemanticType() {
    return 'owl:DatatypeProperty';
  }

  getSemanticId() {
    return 'ex:hasEmail';
  }

  toRDF() {
    return `${this.id} rdf:type owl:DatatypeProperty .`;
  }
}

module.exports = HasEmail;
