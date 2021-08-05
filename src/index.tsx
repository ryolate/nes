import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import { Demo } from './sandbox'
import * as Breakout from './breakout'
import * as NESUI from './nesui'

import {
    HashRouter as Router,
    NavLink, Route, Switch
} from 'react-router-dom'

function App() {
    return (
        <Router>
            <nav className="navbar navbar-expand navbar-light bg-light">
                <ul className="navbar-nav">
                    <li className="navbar-item"><NavLink className="nav-link" exact to="/">Home</NavLink></li>
                    <li className="navbar-item"><NavLink className="nav-link" to="/sandbox">Sandbox</NavLink></li>
                    <li className="navbar-item"><NavLink className="nav-link" to="/breakout">Breakout</NavLink></li>
                    <li className="navbar-item"><NavLink className="nav-link" to="/nes">NES</NavLink></li>
                </ul>
            </nav>
            <div>
                {/* A <Switch> looks through its children <Route>s and
              renders the first one that matches the current URL. */}
                <Switch>
                    <Route path="/sandbox"><Demo /></Route>
                    <Route path="/breakout"><Breakout.App /></Route>
                    <Route path="/nes"><NESUI.App /></Route>
                    <Route path="/"><h2>Welcome to my homepage!</h2></Route>
                </Switch>
            </div>
        </Router>
    )
}

ReactDOM.render(
    <App />,
    document.getElementById('app'),
)
