// Generated from semantic ontology: ex:Person
// Entity: Person
// Type: owl:Class

class Person {
  constructor(data = {}) {
    this.id = data.id;
  }

  // Semantic methods
  getSemanticType() {
    return 'owl:Class';
  }

  getSemanticId() {
    return 'ex:Person';
  }

  toRDF() {
    return `${this.id} rdf:type owl:Class .`;
  }
}

module.exports = Person;
