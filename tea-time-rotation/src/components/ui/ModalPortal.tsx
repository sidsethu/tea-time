import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

const ModalPortal = ({ children }: { children: ReactNode }) =>
  createPortal(children, document.body);

export default ModalPortal;
