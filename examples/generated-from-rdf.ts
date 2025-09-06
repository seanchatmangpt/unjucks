
// Generated from RDF data
export class Organization {
  name = "Acme Corp";
  employees = 500;
  url = "https://acme.example.com";
  
  team = [
    
    {
      name: "Alice Johnson",
      title: "CTO",
      type: "Person"
    },
    
    {
      name: "Bob Smith",
      title: "Developer",
      type: "Person"
    },
    
  ];
}

// Using RDF filters
const organizationTypes = ["https://schema.org/Organization"];
const personNames = [];
  