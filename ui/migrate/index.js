import React, { useEffect, useState } from 'react';
// import Form from '../../ui/Form';
import Setup from '../../components/migrate/setup';
import classes from './migrate.module.css';
import { Button, Paper, Typography } from '@mui/material';
import Unlock from '../../components/unlock';
import stores from '../../stores';
import { useRouter } from 'next/router';
import { ACTIONS } from '../../stores/constants';
import { useAppThemeContext } from '../../ui/AppThemeProvider';
import BtnEnterApp from '../../ui/BtnEnterApp';

export default function Migrate() {
  const accountStore = stores.accountStore.getStore('account');
  const router = useRouter();
  const [account, setAccount] = useState(accountStore);
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    const accountConfigure = () => {
      const accountStore = stores.accountStore.getStore('account');
      setAccount(accountStore);
      closeUnlock();
    };
    const connectWallet = () => {
      onAddressClicked();
    };

    stores.emitter.on(ACTIONS.ACCOUNT_CONFIGURED, accountConfigure);
    stores.emitter.on(ACTIONS.CONNECT_WALLET, connectWallet);
    return () => {
      stores.emitter.removeListener(ACTIONS.ACCOUNT_CONFIGURED, accountConfigure);
      stores.emitter.removeListener(ACTIONS.CONNECT_WALLET, connectWallet);
    };
  }, []);

  const onAddressClicked = () => {
    setUnlockOpen(true);
  };

  const closeUnlock = () => {
    setUnlockOpen(false);
  };

  const {appTheme} = useAppThemeContext();

  const [isHoverState, setIsHoverState] = useState(false);
  const [isClickState, setIsClickState] = useState(false);
  const [btnColor, setBtnColor] = useState(appTheme === 'dark' ? '#4c2828' : '#f2d0d0');

  const btnDefaultColor = () => {
    setIsHoverState(false);
    setIsClickState(false);
  };

  const btnHoverColor = () => {
    setIsHoverState(true);
  };

  const btnClickColor = () => {
    setIsClickState(true);
  };

  const getBtnColor = () => {
    switch (appTheme) {
      case 'dark':
        return isClickState ? '#803838' : (isHoverState ? '#612e2e' : '#4c2828');

      case 'light':
      default:
        return isClickState ? '#eea4a4' : (isHoverState ? '#f0baba' : '#f2d0d0');
    }
  };

  return (
    <>
      {account && account.address
        ? <Setup/>
        :
        <Paper className={classes.notConnectedContent}>
          <div className={classes.contentFloat}>
            <Typography className={classes.contentFloatText}>
              Migrate
            </Typography>

            <div className={[classes.mainDescBg, classes[`mainDescBg--${appTheme}`]].join(' ')}>
              <Typography className={[classes.mainDescNC, classes[`mainDescNC--${appTheme}`]].join(' ')}
                          variant="body2">
                Migrate your LP tokens.
              </Typography>
            </div>

            <div
              className={[classes.buttonConnect, classes[`buttonConnect--${appTheme}`]].join(' ')}
              onMouseOver={btnHoverColor}
              onMouseOut={btnDefaultColor}
              onMouseDown={btnClickColor}
              onClick={onAddressClicked}>
              <BtnEnterApp
                labelClassName={classes.buttonEnterLabel}
                label={`Connect wallet\nto continue`}
                btnColor={getBtnColor}
              />
            </div>
          </div>
        </Paper>
      }
      {unlockOpen && <Unlock modalOpen={unlockOpen} closeModal={closeUnlock}/>}
    </>
  );
}
