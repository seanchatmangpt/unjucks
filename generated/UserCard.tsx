
import React from 'react';

interface UserCardProps {

  name: string;

  email: string;

  avatar?: string;

}

export const UserCard: React.FC<UserCardProps> = ({

  name,

  email,

  avatar

}) => {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>{email}</p>
      
      {avatar && <img src={avatar} alt={name} />}
      
    </div>
  );
};
