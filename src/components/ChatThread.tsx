import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getMessages, sendMessage, markMessageRead } from '../api';
import { UserProfile, Message } from '../types';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';

interface Props {
  bidId: string;
  cropType: string;
  partnerId: string;
  partnerName: string;
  profile: UserProfile;
  onClose: () => void;
}

export default function ChatThread({ bidId, cropType, partnerId, partnerName, profile, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(bidId);
      setMessages(data);
      // Mark unread messages as read
      data.filter((m: Message) => m.receiverId === profile.uid && !m.read)
          .forEach((m: Message) => markMessageRead(m.id));
    } catch {}
  }, [bidId, profile.uid]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage({
        bidId,
        cropId: '',
        senderId: profile.uid,
        senderName: profile.name,
        senderRole: profile.role,
        receiverId: partnerId,
        text: msg,
      });
      await load();
    } catch {}
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-md flex flex-col shadow-2xl overflow-hidden max-h-[80vh]"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {partnerName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm">{partnerName}</p>
              <p className="text-xs text-white/70">Re: {cropType}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-emerald-50/30 min-h-[280px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <MessageSquare className="w-8 h-8 text-emerald-200" />
              <p className="text-sm text-emerald-900/40">Start the conversation!</p>
            </div>
          )}
          {messages.map(m => {
            const isMine = m.senderId === profile.uid;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMine
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white text-emerald-950 rounded-bl-md border border-emerald-100'
                }`}>
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-emerald-900/30'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (m.read ? ' ✓✓' : ' ✓')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-emerald-100 bg-white">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 bg-emerald-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
