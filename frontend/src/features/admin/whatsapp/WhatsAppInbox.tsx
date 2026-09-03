'use client';

import React from 'react';
import { WhatsAppInboxContainer } from './inbox/WhatsAppInboxContainer';
import { Program } from '../../../types/event';
import { MetaTemplate } from '../../../types/whatsapp';

interface WhatsAppInboxProps {
  events: Program[];
  metaTemplates: MetaTemplate[];
  onOpenTimeline?: (inquiryId: string) => void;
}

export const WhatsAppInbox: React.FC<WhatsAppInboxProps> = ({
  events,
  metaTemplates,
  onOpenTimeline
}) => {
  return (
    <WhatsAppInboxContainer
      events={events}
      metaTemplates={metaTemplates}
      onOpenTimeline={onOpenTimeline}
    />
  );
};
