
-- Generated from RDF Ontology

CREATE TABLE users (
  
  id SERIAL PRIMARY KEY,
  
  email VARCHAR(255) NOT NULL UNIQUE,
  
  username VARCHAR(50) NOT NULL UNIQUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  
);


CREATE UNIQUE INDEX idx_users_email 
  ON users (email);



CREATE TABLE posts (
  
  id SERIAL PRIMARY KEY,
  
  title VARCHAR(200) NOT NULL,
  
  content TEXT,
  
  author_id INTEGER NOT NULL
  
);


CREATE INDEX idx_posts_author 
  ON posts (author_id);




-- Foreign Key Constraints


ALTER TABLE users 
  ADD CONSTRAINT fk_users_posts
  FOREIGN KEY () 
  REFERENCES (id)
  ;



ALTER TABLE posts 
  ADD CONSTRAINT fk_posts_author
  FOREIGN KEY (author_id) 
  REFERENCES users(id)
  ON DELETE CASCADE;


