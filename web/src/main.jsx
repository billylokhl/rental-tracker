import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import { render } from 'preact';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));
