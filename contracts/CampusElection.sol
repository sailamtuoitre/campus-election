// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Campus Election - one vote per address, for a fixed candidate list.
contract CampusElection {
    struct Candidate { string name; uint256 voteCount; }
    address public immutable administrator;
    bool public votingOpen;
    bool public registrationClosed;
    uint256 public totalVotes;
    Candidate[] private candidates;
    mapping(address => bool) public hasVoted;
    mapping(bytes32 => bool) private registeredNames;

    event CandidateRegistered(uint256 indexed candidateId, string name);
    event VotingStatusChanged(bool isOpen);
    event VoteCast(address indexed voter, uint256 indexed candidateId);

    constructor() { administrator = msg.sender; }

    modifier onlyAdministrator() {
        require(msg.sender == administrator, "Administrator only");
        _;
    }

    // Danh sach ung vien bi khoa vinh vien sau lan mo bo phieu dau tien.
    function registerCandidate(string calldata name) external onlyAdministrator {
        require(!registrationClosed, "Registration closed");
        uint256 length = bytes(name).length;
        require(length > 0 && length <= 80, "Name must be 1-80 bytes");
        bool nonWhitespace;
        for (uint256 i; i < length; ++i) {
            if (uint8(bytes(name)[i]) > 32) nonWhitespace = true;
        }
        require(nonWhitespace, "Name cannot be blank");
        bytes32 key = keccak256(bytes(name));
        require(!registeredNames[key], "Candidate already registered");
        registeredNames[key] = true;
        candidates.push(Candidate(name, 0));
        emit CandidateRegistered(candidates.length - 1, name);
    }

    function openVoting() external onlyAdministrator {
        require(!votingOpen, "Voting already open");
        require(candidates.length >= 2, "Register at least two candidates");
        registrationClosed = true;
        votingOpen = true;
        emit VotingStatusChanged(true);
    }

    function closeVoting() external onlyAdministrator {
        require(votingOpen, "Voting already closed");
        votingOpen = false;
        emit VotingStatusChanged(false);
    }

    // Quyen bo phieu duoc kiem tra tren blockchain, khong phu thuoc giao dien.
    function vote(uint256 candidateId) external {
        require(votingOpen, "Voting is closed");
        require(!hasVoted[msg.sender], "Address already voted");
        require(candidateId < candidates.length, "Invalid candidate");
        hasVoted[msg.sender] = true;
        candidates[candidateId].voteCount += 1;
        totalVotes += 1;
        emit VoteCast(msg.sender, candidateId);
    }

    function getCandidates() external view returns (Candidate[] memory) {
        return candidates;
    }
}
