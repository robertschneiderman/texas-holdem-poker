import React from 'react';
import Player from './player/player';
import PlayerDisplay from './player/player_display';
import Stage from './stage/stage';
import Modal from './player/modal';
import Message from './message';
import Interface from './interface/interface';
import { deck } from '../util/deck';
import shuffle from 'lodash/shuffle';
import merge from 'lodash/merge';
import uniq from 'lodash/uniq';
import drop from 'lodash/drop';
import take from 'lodash/take';
import isEqual from 'lodash/isEqual';
import { RANKS, count, sortNumber, greatestHand, greatestHold, tiebreaker, PokerHand, handName, getHandOdds} from './poker_hands';
import * as svgMessages from './svg_messages';

const roundTimes = 1000;
const aiTime = 1000;

const defaultPlayer = {
  hold: [{
    suit: null,
    rank: null
  },{
    suit: null,
    rank: null
  }],
  hand: '',
  stake: 0
};

const defaultState = {
  pot: 0,
  deck: deck,
  round: 0,
  turn: 0,
  stage: [],
  looped: false,
  message: '',
  setOver: false,
  gameOver: false,
  playerAllIn: false,
  players: [ merge({}, defaultPlayer), merge({}, defaultPlayer) ]
}

// rounds = 'pre-round', 'pre-flop', 'flop', 'turn', 'river'


class Game extends React.Component {

  constructor(props) {
    super(props);
    
    this.state = defaultState;
    this.state.dealer = -1;
    this.state.players[0].bank = 1000;
    this.state.players[0].name = 'You';
    this.state.players[1].bank = 1000;
    this.state.players[1].name = 'Chuck';
    
    window.state = this.state;
  }

  nextSet() {
    let player1Bank = this.state.players[0].bank;
    let player2Bank = this.state.players[1].bank;

    let newState = merge({}, defaultState);
    newState.dealer = (this.state.dealer + 1) % 2;
    newState.players[0].bank = player1Bank;
    newState.players[1].bank = player2Bank;

    this.setState(newState, this.deal.bind(this));
  }  

  deal() {
    let deck = shuffle(this.state.deck);
    let cardsToDeal = deck.splice(48);
    let newState = merge({}, this.state);

    newState.players[0].hold = cardsToDeal.slice(0, 2);
    newState.players[1].hold = cardsToDeal.slice(2);
    newState.deck = deck;
    newState.round = 1;

    this.playSound('deal-sound');

    this.setState(newState, this.collectAntes);
  }

  collectAntes() {
    let dealer = String(this.state.dealer);
    let smallIdx = (this.state.dealer + 1) % 2;
    let bigIdx = (this.state.dealer + 2) % 2;

    let newState = merge({}, this.state);
    newState.players[smallIdx].bank -= 25;
    newState.players[smallIdx].stake += 25;
    newState.players[bigIdx].bank -= 50;
    newState.players[bigIdx].stake += 50;

    this.setState(newState, this.nextTurn);
  }

  nextRound() {
    let nextRound = (this.state.round + 1);
    let pot = (this.state.pot + this.state.players[0].stake + this.state.players[1].stake);
    
    this.resetPlayerStakes();

    if (nextRound > 4) {
      this.setState({
        pot: pot,
      }, this.collectWinnings);
    } else {
      this.playSound('next-card-sound');
      this.setState({
        deck: this.alterDeck(nextRound).deck,
        stage: this.alterDeck(nextRound).cards,
        pot: pot,
        round: nextRound,
        turn: this.state.dealer,
        looped: false
      }, this.nextTurn);      
    }
  } 

  collectWinnings(playerWhoDidntFold) {
    let winningPlayer = this.determineWinner(playerWhoDidntFold);
    let losingPlayer;

    let players = merge([], this.state.players);


    players.map(player => {
      if (isEqual(player, winningPlayer)) {
        player.hand = handName(this.state.stage, player.hold);
        player.bank += this.state.pot;
        winningPlayer = player;
        winningPlayer.hand = player.hand;
      } else {
        player.hand = handName(this.state.stage, player.hold);        
        losingPlayer = player;
      }
    });

    (winningPlayer.name === 'You') ? this.playSound('win-sound') : this.playSound('lose-sound');

    let message = `${winningPlayer.name} won! ${winningPlayer.hand} over ${losingPlayer.hand}`;
    this.setState({players}, this.displayWinner.bind(this, message));
  }


  determineWinner(playerWhoDidntFold) {
    if (playerWhoDidntFold) {
      return playerWhoDidntFold;
    } else {
      let holds = [this.state.players[0].hold, this.state.players[1].hold];
      let winningHold = greatestHold(this.state.stage, holds);

      let players = merge([], this.state.players);

      if (winningHold) {

        for (var i = 0; i < players.length; i++) {
          if (isEqual(players[i].hold, winningHold)) {
            return players[i];
          }
        };      
      } else {
        // IMPLEMENT TIEING!
      }      
    }
  }

  // winnersHand() {

  // }

  resetPlayerStakes() {
    let newState = merge({}, this.state);
    newState.players[0].stake = 0;
    newState.players[1].stake = 0;
    this.setState(newState);
  }  

  alterDeck(round) {
    let deck = this.state.deck;
    let cards;
    switch (round) {
      case 2:
        cards = take(deck, 3);
        deck = drop(deck, 3);
        return {deck, cards: cards.concat(this.state.stage)};
      case (3):
        cards = take(deck, 1);
        deck = drop(deck, 1);
        return {deck, cards: cards.concat(this.state.stage)};
      case (4):
        cards = take(deck, 1);
        deck = drop(deck, 1);
        return {deck, cards: cards.concat(this.state.stage)};
      default:
        return [];       
    }
  }

  nextTurn() {
    if (this.state.setOver) {
      let message = `${this.otherPlayer().name} won!`;
      this.displayWinner(message);
    } else if ( (this.allStakesEven()) && (this.state.looped)) {
      this.nextRound();
    } else {
      let nextTurn = (this.state.turn + 1) % 2;

      if (nextTurn === this.state.dealer) { //FIX!!!!!!!!!
        this.setState({ turn: nextTurn, message: '', looped: true }, this.aiFormulateMove);
      } else {
        this.setState({ turn: nextTurn, message: '', }, this.aiFormulateMove);        
      }   
    }
  }  

  allStakesEven() {
    let stakes = this.state.players.map(player => player.stake);
    let val = (uniq(stakes).length === 1)
    return val;
  }

  aiMove(odds) {
    let move;
    let wOdds = odds.win;
    if ((wOdds < 0.33) && (this.state.players[1].stake < this.state.players[0].stake)) {
      move = this.fold;
    } else if (wOdds < 0.66) {
      move = this.callOrCheck;
    } else {
      move = this.raise;
    }    

    setTimeout(move.bind(this), aiTime);
  }

  aiFormulateMove() {
    if (this.state.turn !== 1) return;

    let randomNumber = Math.floor(Math.random() * 1);

    // implement a confidence factor based on how much human player bets... bluff only when safe...

    if (randomNumber === 0) {
      setTimeout(this.raise.bind(this), aiTime); // bluff
    } else if (randomNumber === 1) {
      setTimeout(this.callOrCheck.bind(this), aiTime); // slow play
    } else {
      // let odds = getHandOdds(this.state.stage, this.state.players[1].hold, this.aiMove.bind(this));
    }
  }

  smartMove(odds) {
    // return (this.state.players[1].pot * odds); 
  }  

  callOrCheck() {
    let newState = merge({}, this.state);
    let turnStr = String(this.state.turn);
    let oldStake = newState.players[this.currentIndex()].stake;
    let otherStake = newState.players[this.otherIndex()].stake;

    let message = 'Checked';
    let sound = 'checked-sound';

    if (oldStake < otherStake) {
      newState.players[turnStr].stake = otherStake;
      newState.players[turnStr].bank -= (otherStake - oldStake);
      
      // message = 'Called';
      svgMessages.called();

      sound = 'called-sound';
    } else {
      svgMessages.checked();
      // this.playSound('check-sound');
    }

    this.playSound(sound);

    this.setState(newState, this.displayMessage.bind(this, message));
  }

  raise() {
    let turnStr = String(this.state.turn)    
    let newState = merge({}, this.state);
    let highestStake = this.highestStake();

    let playerStake = newState.players[turnStr].stake;
    let otherPlayerStake = this.otherPlayer().stake;

    let differenceInStake = highestStake - playerStake;

    let amountToWager = differenceInStake + 50;

    amountToWager = (amountToWager > newState.players[turnStr].bank) ? newState.players[turnStr].bank : amountToWager;

    newState.players[turnStr].stake += amountToWager;
    newState.players[turnStr].bank -= amountToWager;

    this.playSound('raise-sound');

    let message = 'Reraised';

    

    if (highestStake === 0) {
      svgMessages.raised();
    }

    if ( (this.state.round === 1) && ((otherPlayerStake === 25) || (otherPlayerStake === 50)) ) {
      svgMessages.raised();    
    }
    
    this.setState(newState, this.displayMessage.bind(this, message));
  }

  fold() {
    // duplicated in 'nextRound'
    let pot = (this.state.pot + this.state.players[0].stake + this.state.players[1].stake);

    svgMessages.folded();

    let message = `${this.currentPlayer().name} folded`;

    this.setState({
      pot: pot,
      setOver: true
    }, this.displayMessage.bind(this, message));
// this.collectWinnings.bind(this, this.otherPlayer())

  }

  playSound(selector) {
    let sound = document.getElementById(selector);
    sound.play();    
  }

  displayWinner(message) {

    let gameOver = false;

    this.state.players.forEach(player => {
      if (player.bank === 0) {
        gameOver = true;
      }
    });

    svgMessages.chuckWon();

    this.setState({message, setOver: true, gameOver});
    // setTimeout(this.nextSet.bind(this), 2000);
  }  

  displayMessage(message) {
    this.setState({message});
    setTimeout(this.nextTurn.bind(this), 700);
  }

  highestStake() {
    let highestStake = 0;
    this.state.players.forEach(player => {
      if (player.stake > highestStake) highestStake = player.stake;
    });
    return highestStake;
  }

  currentPlayer() {
    return this.state.players[this.state.turn];
  }

  otherPlayer() {
    return (this.state.turn === 0) ? this.state.players[1] : this.state.players[0];
  }

  currentIndex() {
    return (this.state.turn === 0) ? 0 : 1;
  }  

  otherIndex() {
    return (this.state.turn === 0) ? 1 : 0;
  }

  render() {
    window.state = this.state;
    return(
      <div className="game">

        <main className="main">
          <div className="table">
            <Modal gameOver={this.state.gameOver} />
            <ul className="players">
              <Player
                num={0}
                dealer={this.state.dealer}
                round={this.state.round}
                turn={this.state.turn}
                player={this.state.players[0]} />
              <Player
                num={1}
                setOver={this.state.setOver}
                dealer={this.state.dealer}
                round={this.state.round}
                turn={this.state.turn}
                player={this.state.players[1]} />
            </ul>
          
            <Stage 
              pot={this.state.pot} 
              cards={this.state.stage} />
          </div>
        </main>

        <PlayerDisplay player={this.state.players[0]} />
        <PlayerDisplay player={this.state.players[1]} />

        <Interface
          nextSet={this.nextSet.bind(this)}
          setOver={this.state.setOver}           
          round={this.state.round}
          turn={this.state.turn}
          players={this.state.players}
          callOrCheck={this.callOrCheck.bind(this)}
          fold={this.fold.bind(this)}
          message={this.state.message}
          raise={this.raise.bind(this)} />

        <Message message={this.state.message} />
      </div>
    );
  }
}

export default Game;