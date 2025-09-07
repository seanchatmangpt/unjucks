// Generated from semantic ontology: ex:User
// Entity: User
// Type: owl:Class

class User {
  constructor(data = {}) {
    this.id = data.id;
  }

  // Semantic methods
  getSemanticType() {
    return 'owl:Class';
  }

  getSemanticId() {
    return 'ex:User';
  }

  toRDF() {
    return `${this.id} rdf:type owl:Class .`;
  }
}

module.exports = User;
