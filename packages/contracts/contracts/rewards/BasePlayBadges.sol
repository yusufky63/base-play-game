// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BasePlayBadges
 * @dev ERC-1155 multi-token badge and achievement contract for BasePlay on Base.
 * Supports secure EIP-712 signature-based claiming, soulbound achievement mode, and batch minting.
 */
contract BasePlayBadges is ERC1155, Ownable, EIP712 {
    using Strings for uint256;

    string public name = "BasePlay Badges";
    string public symbol = "BPBADGE";
    string private _baseTokenURI;

    address public trustedSigner;
    bool public soulbound = true;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("ClaimBadge(address player,uint256 tokenId,uint256 deadline)");

    bytes32 public constant BATCH_CLAIM_TYPEHASH =
        keccak256("ClaimBadgesBatch(address player,uint256[] tokenIds,uint256 deadline)");

    mapping(address => mapping(uint256 => bool)) public hasClaimed;
    mapping(uint256 => uint256) public totalMinted;

    event BadgeClaimed(address indexed player, uint256 indexed tokenId);
    event BadgesClaimedBatch(address indexed player, uint256[] tokenIds);
    event SignerUpdated(address indexed previousSigner, address indexed newSigner);
    event BaseURIUpdated(string newURI);
    event SoulboundUpdated(bool soulbound);

    error InvalidSignature();
    error SignatureExpired();
    error AlreadyClaimed(uint256 tokenId);
    error ArrayLengthMismatch();
    error EmptyBatch();
    error SoulboundTransferDisabled();
    error InvalidSigner();

    constructor(
        address _signer,
        string memory _initialBaseURI
    ) ERC1155(_initialBaseURI) EIP712("BasePlay Badges", "1") Ownable(msg.sender) {
        if (_signer == address(0)) revert InvalidSigner();
        trustedSigner = _signer;
        _baseTokenURI = _initialBaseURI;
    }

    /**
     * @notice Claims a single unlocked badge using an EIP-712 signature from the trusted platform signer.
     * @param tokenId The badge token ID (1..20+).
     * @param deadline Unix timestamp until which the signature is valid.
     * @param signature Cryptographic signature by trustedSigner.
     */
    function claimBadge(
        uint256 tokenId,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (hasClaimed[msg.sender][tokenId]) revert AlreadyClaimed(tokenId);

        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, msg.sender, tokenId, deadline)
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(hash, signature);

        if (recoveredSigner != trustedSigner) revert InvalidSignature();

        hasClaimed[msg.sender][tokenId] = true;
        totalMinted[tokenId] += 1;

        _mint(msg.sender, tokenId, 1, "");
        emit BadgeClaimed(msg.sender, tokenId);
    }

    /**
     * @notice Claims multiple unlocked badges in a single transaction.
     * @param tokenIds Array of badge token IDs.
     * @param deadline Unix timestamp until which the signature is valid.
     * @param signature Cryptographic signature for the batch by trustedSigner.
     */
    function claimBadgesBatch(
        uint256[] calldata tokenIds,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();
        uint256 length = tokenIds.length;
        if (length == 0) revert EmptyBatch();

        bytes32 structHash = keccak256(
            abi.encode(
                BATCH_CLAIM_TYPEHASH,
                msg.sender,
                keccak256(abi.encodePacked(tokenIds)),
                deadline
            )
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(hash, signature);

        if (recoveredSigner != trustedSigner) revert InvalidSignature();

        uint256[] memory amounts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 tid = tokenIds[i];
            if (hasClaimed[msg.sender][tid]) revert AlreadyClaimed(tid);
            hasClaimed[msg.sender][tid] = true;
            totalMinted[tid] += 1;
            amounts[i] = 1;
        }

        _mintBatch(msg.sender, tokenIds, amounts, "");
        emit BadgesClaimedBatch(msg.sender, tokenIds);
    }

    /**
     * @notice Admin direct mint for promotional or manual attribution.
     */
    function adminMint(address to, uint256 tokenId) external onlyOwner {
        hasClaimed[to][tokenId] = true;
        totalMinted[tokenId] += 1;
        _mint(to, tokenId, 1, "");
        emit BadgeClaimed(to, tokenId);
    }

    /**
     * @notice Returns the metadata URI for a specific badge token ID.
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        if (bytes(_baseTokenURI).length == 0) {
            return super.uri(tokenId);
        }
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }

    /**
     * @notice Sets the metadata base URI.
     */
    function setURI(string memory newURI) external onlyOwner {
        _baseTokenURI = newURI;
        _setURI(newURI);
        emit BaseURIUpdated(newURI);
    }

    /**
     * @notice Updates the trusted backend signer address.
     */
    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidSigner();
        emit SignerUpdated(trustedSigner, newSigner);
        trustedSigner = newSigner;
    }

    /**
     * @notice Toggles soulbound mode (preventing transfer between players).
     */
    function setSoulbound(bool _soulbound) external onlyOwner {
        soulbound = _soulbound;
        emit SoulboundUpdated(_soulbound);
    }

    /**
     * @dev Hook that is called before any token transfer. Enforces soulbound restriction if enabled.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (soulbound && from != address(0) && to != address(0)) {
            revert SoulboundTransferDisabled();
        }
        super._update(from, to, ids, values);
    }
}
