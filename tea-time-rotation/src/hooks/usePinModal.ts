import { useState } from 'react';

export const usePinModal = () => {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  const showPinModal = (confirmCallback: () => void) => {
    setOnConfirm(() => confirmCallback);
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
    setOnConfirm(null);
  };

  return {
    isPinModalOpen,
    onConfirm,
    showPinModal,
    closePinModal,
  };
};
