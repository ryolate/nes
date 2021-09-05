const path = require('path')

module.exports = {
    entry: './src/index.tsx',
    output: {
        path: path.resolve(__dirname, 'docs'),
        filename: 'generated_app.js'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    devServer: {
        contentBase: './docs',
        watchContentBase: true,
    },
};
