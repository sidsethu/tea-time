import { useState } from 'react';

interface ModalConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalConfig | null>(null);
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  const showModal = (modalConfig: ModalConfig, confirmCallback?: () => void) => {
    setConfig(modalConfig);
    setOnConfirm(() => confirmCallback || (() => {}));
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setConfig(null);
    setOnConfirm(null);
  };

  const showSuccess = (title: string, message: string) => {
    showModal({ title, message, type: 'success' });
  };

  const showError = (title: string, message: string) => {
    showModal({ title, message, type: 'error' });
  };

  const showWarning = (title: string, message: string) => {
    showModal({ title, message, type: 'warning' });
  };

  const showConfirm = (
    title: string, 
    message: string, 
    confirmCallback: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) => {
    showModal({ 
      title, 
      message, 
      type: 'warning', 
      showCancel: true,
      confirmText,
      cancelText
    }, confirmCallback);
  };

  return {
    isOpen,
    config,
    onConfirm,
    closeModal,
    showSuccess,
    showError,
    showWarning,
    showConfirm
  };
};