import React from 'react';
import './DangerZone.css';

interface DangerZoneProps {
  title: string;
  children: React.ReactNode;
}

const DangerZone: React.FC<DangerZoneProps> = ({ title, children }) => {
  return (
    <div className="danger-zone">
      <h3 className="danger-zone-title">{title}</h3>
      <div className="danger-zone-content">{children}</div>
    </div>
  );
};

export default DangerZone;
