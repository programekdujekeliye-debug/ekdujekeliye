import React from 'react';

interface QuickRepliesBarProps {
  onSelectReply: (text: string) => void;
}

export const GUJARATI_QUICK_REPLIES = [
  'નમસ્તે! એક દુજે કે લિયે કાર્યક્રમમાં આપનું હાર્દિક સ્વાગત છે. અમે તમને કેવી રીતે મદદ કરી શકીએ?',
  'તમારું રજીસ્ટ્રેશન અને પેમેન્ટ કન્ફર્મ છે. આપનો ડિજિટલ પાસ જોવા માટે વેબસાઇટની લિંક ચેક કરશો.',
  'કાર્યક્રમ સ્થળ: સરદાર પટેલ સ્મૃતિ ભવન, મીની બજાર, વરાછા, સુરત.',
  'રિપોર્ટિંગ સમય: સાંજે 8:00 વાગ્યે (કાર્યક્રમ 8:30 વાગ્યે શરૂ થશે).',
  'ઓડિટોરિયમ પાસે પૂરતી પાર્કિંગ સુવિધા ઉપલબ્ધ છે.',
  'અમારી ટીમ તમારી વિગતો ચેક કરી રહી છે, થોડી વારમાં જાણ કરીએ છીએ.'
];

export const QuickRepliesBar: React.FC<QuickRepliesBarProps> = ({ onSelectReply }) => {
  return (
    <div className="bg-stone-100/90 px-3 py-1.5 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none select-none">
      <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
        ઝડપી જવાબ:
      </span>
      {GUJARATI_QUICK_REPLIES.map((reply, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelectReply(reply)}
          className="px-2.5 py-1 bg-white hover:bg-rose-50 hover:text-rose-800 text-stone-700 rounded-full whitespace-nowrap font-medium text-[11px] transition-colors border border-stone-200/80 shadow-2xs cursor-pointer flex-shrink-0"
        >
          {reply.slice(0, 32)}...
        </button>
      ))}
    </div>
  );
};
