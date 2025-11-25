import { Button, Menu, MenuButton, MenuList, MenuItem, Icon } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import React from 'react';

interface AccountMenuProps {
  onLogout: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({ onLogout }) => {
  const router = useRouter();

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="ghost"
        color="gray.600"
        rightIcon={
          <Icon viewBox="0 0 24 24" boxSize={4}>
            <path
              fill="currentColor"
              d="M7 10l5 5 5-5z"
            />
          </Icon>
        }
      >
        Account
      </MenuButton>
      <MenuList>
        <MenuItem
          icon={
            <Icon viewBox="0 0 24 24" boxSize={4}>
              <path
                fill="currentColor"
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </Icon>
          }
          onClick={() => router.push('/account')}
        >
          Account Settings
        </MenuItem>
        <MenuItem
          icon={
            <Icon viewBox="0 0 24 24" boxSize={4}>
              <path
                fill="currentColor"
                d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
              />
            </Icon>
          }
          onClick={onLogout}
        >
          Logout
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

