import React from 'react';
import styles from '../styles/qerunTheme.module.css';

const Logo: React.FC = () => {
  return (
    <div className={styles.qerunLogoContainer}>
      <img src="/logo.png" alt="Qerun crown logo" width="96" height="96" className={styles.qerunLogo} />
    </div>
  );
};

export default Logo;