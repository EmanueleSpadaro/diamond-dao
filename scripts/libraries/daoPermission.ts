export enum DaoPermission {
    //Whether it can alter the inviteOnly flag for the given DAO
    invite_switch,
    //Whether it can manage all tokens
    token_all,
    //Whether it can manage only specific tokens
    token_specific,
    //Whether it can transfer manageable tokens
    token_transfer,
    //Whether it can create tokens
    token_create,
    //Whether it can mint manageable tokens
    token_mint,
    //Whether it can authorize others to use a specific token
    token_auth,
    //Whether it can be set as authorized to manage specific tokens
    token_canmanage,
    //Whether it can create a crowdsale
    crowd_create,
    //Whether it can join a crowdsale
    crowd_join,
    //Whether it can unlock a crowdsale
    crowd_unlock,
    //Whether it can refund a crowdsale
    crowd_refund,
    //Whether it can stop a crowdsale
    crowd_stop,
    //Whether it can offer / revoke a DAO member (must have crowd_canmanage permission) management privileges regarding a specific crowdsale
    crowd_setadmin,
    //Whether it can be set as crowdsale manager by members with crowd_setadmin permissions
    crowd_canmanage,
    //Whether it can create an exchange
    exchange_create,
    //Whether it can cancel an exchange
    exchange_cancel,
    //Whether it can renew an exchange
    exchange_renew,
    //Whether it can accept an exchange
    exchange_accept,
    //Whether it can refill an exchange
    exchange_refill,
    //Whether it can offer / revoke a DAO member (that has exchange_canmanage permission) management privileges regarding a specific exchange
    exchange_setadmin,
    //Whether it can be set as exchange manager by members with exchange_setadmin permissions
    exchange_canmanage,
    //using the "counting enum pattern" to get the number of elements in the enum
    COUNT
}