
import React from 'react';
import { Home, FolderOpen, Settings, Gamepad2 } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const tabs = [
    { id: AppView.GENERATOR, icon: Home, label: 'Generator' },
    { id: AppView.VIRTUAL_ROOM, icon: Gamepad2, label: 'Mixer' },
    { id: AppView.WORKSPACE, icon: FolderOpen, label: 'Workspace' },
    { id: AppView.SETTINGS, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl shadow-indigo-900/10 p-1.5 flex justify-between items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onChangeView(tab.id)}
              className={`
                relative flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all duration-300
                ${isActive 
                  ? 'text-indigo-600 bg-indigo-50/50' 
                  : 'text-slate-400 hover:text-indigo-400 hover:bg-white/50'}
              `}
            >
              <div className={`relative ${isActive ? 'transform -translate-y-1' : ''} transition-transform duration-300`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'} transition-all duration-300`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
