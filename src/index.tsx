import React from 'react'
import ReactDOM from 'react-dom'
import {
    HashRouter as Router,
    NavLink, Route, Switch
} from 'react-router-dom'
import * as NESUI from './ui/main'

const CIApp = () => {
    return <div>Hello CI!</div>
}

function App() {
    return (
        <Router>
            <nav style={{
                display: "flex",
                gap: 10,
            }}>
                <NavLink exact to="/">nes</NavLink>
                <NavLink to="/ci">ci</NavLink>
            </nav>
            <div>
                <Switch>
                    <Route path="/ci"><CIApp /></Route>
                    <Route path="/"><NESUI.App /></Route>
                </Switch>
            </div>
        </Router >
    )
}

ReactDOM.render(
    <App />,
    document.getElementById('app'),
)
