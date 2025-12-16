import React from 'react';

export interface HelloProps {
  name?: string;
}

export const Hello: React.FC<HelloProps> = ({ name = 'World' }) => {
  return <div>Hello, {name}!</div>;
};

export default Hello;
