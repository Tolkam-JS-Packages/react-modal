# tolkam/react-modal

Component for building modal windows.

## Usage

````tsx
import { PureComponent } from 'react';
import { render } from 'react-dom';
import Modal from '@tolkam/react-modal';

class MyClass extends PureComponent {
    public state = {
        show: false,
    }

    public render() {
        return <>
            <button onClick={() => this.setState({show: !this.state.show})}>show modal</button>
            <Modal show={this.state.show}>
                I'm a modal window that needs styling
            </Modal>
        </>;
    }
}

render(<MyClass />, document.getElementById('app'));
````

## Documentation

The code is rather self-explanatory and API is intended to be as simple as possible. Please, read the sources/Docblock if you have any questions. See [Usage](#usage) and [IProps](/src/index.tsx#L438) for quick start.

## License

Proprietary / Unlicensed 🤷
