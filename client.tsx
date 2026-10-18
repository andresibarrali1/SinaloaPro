import React from 'react';
import {createRoot} from 'react-dom/client';
import Editor from './components/editor/editor';
import './app/globals.css';
import './app/editor.css';
createRoot(document.getElementById('root')!).render(<Editor/>);
