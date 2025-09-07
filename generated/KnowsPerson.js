// Generated from semantic ontology: ex:knowsPerson
// Entity: knows person
// Type: owl:ObjectProperty

class KnowsPerson {
  constructor(data = {}) {
    this.id = data.id;
  }

  // Semantic methods
  getSemanticType() {
    return 'owl:ObjectProperty';
  }

  getSemanticId() {
    return 'ex:knowsPerson';
  }

  toRDF() {
    return `${this.id} rdf:type owl:ObjectProperty .`;
  }
}

module.exports = KnowsPerson;
