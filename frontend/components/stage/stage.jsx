import React from 'react';
// import Container from './/_container';

class Stage extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    let cards = this.props.cards.map((card, i) => {
    let cardClass = `card ${card.suit} rank${card.rank}`;
    let messageClass = `message message-${this.props.turn}`;
      return(
        <li key={i} className={cardClass}>
          <div className="face">
          </div>
        </li>
      );
    });

    return(
      <section className="stage">
        <p className="message">{this.props.message}</p>
        <span className="pot">Pot: {this.props.pot}</span>
        <ul className="stage-cards">
          {cards}
        </ul>
      </section>
    )
  }
}

export default Stage;