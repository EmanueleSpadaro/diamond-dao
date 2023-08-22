// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

import {DaoPermissable, LibDao} from "./DaoPermissable.sol";
import {LibToken} from "../libraries/facets/LibToken.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract DaoTokenFacet is DaoPermissable {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    function createToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        string memory _logoURL,
        string memory _logoHash,
        uint256 _hardCap,
        string memory _contractHash
    )
        external
        view
        onlyPermitted(LibDao.DaoPermission.token_create)
        returns (bool)
    {
        return true;
        //tokenFactory.createToken(_name, _symbol, _decimals, _logoURL, _logoHash, _hardCap, _contractHash);
    }

    function transferToken(
        string memory _symbol,
        uint256 _amount,
        address _to
    ) public onlyPermitted(LibDao.DaoPermission.token_transfer) {
        require(
            getTokenAuth(_symbol, msg.sender),
            "not authorized to manage token"
        );
        // address tokenAddr = address(0);
        // (tokenAddr, , , , , , ) = tokenFactory.getToken(symbol);
        // ITokenTemplate token = ITokenTemplate(tokenAddr);
        // require(token.balanceOf(address(this)) >= amount, "Must have the tokens in the DAO wallet");
        // require(token.transfer(to, amount), "Must have transferred the tokens");
    }

    function getTokenAuth(
        string memory _symbol,
        address _account
    ) internal view returns (bool) {
        LibToken.DaoTokenStorage storage dts = LibToken.daoTokenStorage();
        return
            isAuthorized(_account, LibDao.DaoPermission.token_all) ||
            (isAuthorized(_account, LibDao.DaoPermission.token_specific) &&
                dts.tokenManagement[_account].managedTokens.contains(
                    keccak256(abi.encodePacked(_symbol))
                ));
    }

    function setTokenAuth(
        string memory _symbol,
        address _account
    )
        external
        isMember(_account)
        onlyPermitted(LibDao.DaoPermission.token_auth)
    {
        require(
            isAuthorized(_account, LibDao.DaoPermission.token_canmanage),
            "Target user has no permissions to be authorized for tokens"
        );
        LibToken.DaoTokenStorage storage dts = LibToken.daoTokenStorage();
        dts.tokenManagement[_account].managedTokens.add(
            keccak256(abi.encodePacked(_symbol))
        );
    }

    function removeTokenAuth(
        string memory symbol,
        address _address
    ) public isMember(_address) onlyPermitted(LibDao.DaoPermission.token_auth) {
        LibToken.DaoTokenStorage storage dts = LibToken.daoTokenStorage();
        require(
            getTokenAuth(symbol, msg.sender),
            "not authorized to manage token"
        );
        require(
            getTokenAuth(symbol, _address),
            "Address already not authorized for this Token"
        );
        dts.tokenManagement[_address].managedTokens.remove(
            keccak256(abi.encodePacked(symbol))
        );
        //TODO: auth emission event
        //emit UserTokenAuthorizationRevoked(msg.sender, _address, symbol);
    }

    function mintToken(
        string memory _name,
        uint256 _value
    ) public onlyPermitted(LibDao.DaoPermission.token_mint) {
        // address addr;
        // (addr, , , , , ,) = tokenFactory.getToken(_name);
        // require(addr != address(0x0), "mintToken: The token must exist");
        // ITokenTemplate tkn = ITokenTemplate(addr);
        // require(tkn.mint(address(this), _value), "mintToken: Must return true");
    }
}
